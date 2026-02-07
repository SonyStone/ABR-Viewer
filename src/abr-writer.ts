/**
 * ABR (Photoshop Brush) File Writer
 * Creates ABR files from brush data (v6.2 format)
 */

import * as fs from 'fs';
import { BinaryWriter } from './binary-writer';
import { DescriptorSerializer, makeDescriptor } from './descriptor-serializer';
import { AbrFile, Brush, BrushTipImage, DescriptorValue } from './types';
import { v4 as uuidv4 } from 'uuid';

const PHOTOSHOP_SIGNATURE = '8BIM';
const SAMPLE_KEY = 'samp';
const DESCRIPTOR_KEY = 'desc';

export interface WriteOptions {
  /** ABR major version (default: 6) */
  version?: number;
  /** ABR minor version (default: 2) */
  subVersion?: number;
  /** Use RLE compression for images (default: true) */
  useRleCompression?: boolean;
}

export class AbrWriter {
  private options: Required<WriteOptions>;

  constructor(options: WriteOptions = {}) {
    this.options = {
      version: options.version ?? 6,
      subVersion: options.subVersion ?? 2,
      useRleCompression: options.useRleCompression ?? true,
    };
  }

  /**
   * Write an ABR file to disk
   */
  writeFile(abrFile: AbrFile, filePath: string): void {
    const buffer = this.write(abrFile);
    fs.writeFileSync(filePath, buffer);
  }

  /**
   * Generate ABR file as a buffer
   */
  write(abrFile: AbrFile): Uint8Array {
    const writer = new BinaryWriter();

    // Write version header
    writer.writeUInt16BE(this.options.version);
    writer.writeUInt16BE(this.options.subVersion);

    // Collect brushes with tips for sample block
    const sampledBrushes = abrFile.brushes.filter(b => b.brushTip && b.type === 'sampled');
    
    // Generate UUIDs for brushes that need them
    const brushUuids = new Map<string, string>();
    for (const brush of sampledBrushes) {
      brushUuids.set(brush.id, uuidv4());
    }

    // Write sample block if there are sampled brushes
    if (sampledBrushes.length > 0) {
      const sampleData = this.writeSampleBlock(sampledBrushes, brushUuids);
      this.writeResourceBlock(writer, SAMPLE_KEY, sampleData);
    }

    // Write descriptor block with brush settings
    const descriptorData = this.writeDescriptorBlock(abrFile.brushes, brushUuids);
    this.writeResourceBlock(writer, DESCRIPTOR_KEY, descriptorData);

    return writer.toBuffer();
  }

  /**
   * Write a resource block (8BIM format)
   */
  private writeResourceBlock(writer: BinaryWriter, key: string, data: Uint8Array): void {
    writer.writeString(PHOTOSHOP_SIGNATURE, 4);
    writer.writeString(key, 4);
    writer.writeUInt32BE(data.length);
    writer.writeBytes(data);
    
    // Pad to 4-byte boundary
    const padding = (4 - (data.length % 4)) % 4;
    if (padding > 0) {
      writer.writePadding(padding);
    }
  }

  /**
   * Write sample block containing brush tip images
   */
  private writeSampleBlock(brushes: Brush[], uuids: Map<string, string>): Uint8Array {
    const writer = new BinaryWriter();

    for (const brush of brushes) {
      if (!brush.brushTip) continue;

      const uuid = uuids.get(brush.id) || uuidv4();
      const sampleWriter = new BinaryWriter();

      // Write UUID (37 chars with leading '$' + null = 38 bytes)
      const uuidString = '$' + uuid;
      sampleWriter.writeString(uuidString, 37);
      sampleWriter.writeUInt8(0); // null terminator

      // Write header padding (263 bytes for subversion 2)
      // This contains brush metadata that we'll initialize to zeros
      // with some key values set
      const headerSize = this.options.subVersion === 1 ? 10 : 263;
      sampleWriter.writePadding(headerSize);

      // Write image bounds (top, left, bottom, right)
      const { width, height } = brush.brushTip;
      sampleWriter.writeUInt32BE(0);        // top
      sampleWriter.writeUInt32BE(0);        // left
      sampleWriter.writeUInt32BE(height);   // bottom
      sampleWriter.writeUInt32BE(width);    // right

      // Write depth (8-bit grayscale)
      sampleWriter.writeUInt16BE(8);

      // Write compression type
      const useRle = this.options.useRleCompression;
      sampleWriter.writeUInt8(useRle ? 1 : 0);

      // Write image data
      if (useRle) {
        this.writeRleCompressedImage(sampleWriter, brush.brushTip);
      } else {
        sampleWriter.writeBytes(brush.brushTip.data);
      }

      // Write sample length and data
      const sampleData = sampleWriter.toBuffer();
      writer.writeUInt32BE(sampleData.length);
      writer.writeBytes(sampleData);

      // Pad to 4-byte boundary
      const padding = (4 - (sampleData.length % 4)) % 4;
      if (padding > 0) {
        writer.writePadding(padding);
      }
    }

    return writer.toBuffer();
  }

  /**
   * Write RLE (PackBits) compressed image data
   */
  private writeRleCompressedImage(writer: BinaryWriter, brushTip: BrushTipImage): void {
    const { width, height, data } = brushTip;
    
    // First, compress all rows and calculate byte counts
    const compressedRows: Uint8Array[] = [];
    const rowByteCounts: number[] = [];

    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      const rowData = data.slice(rowStart, rowStart + width);
      const compressed = this.packBitsCompress(rowData);
      compressedRows.push(compressed);
      rowByteCounts.push(compressed.length);
    }

    // Write row byte counts (2 bytes each)
    for (const count of rowByteCounts) {
      writer.writeUInt16BE(count);
    }

    // Write compressed data
    for (const row of compressedRows) {
      writer.writeBytes(row);
    }
  }

  /**
   * PackBits compression for a single row
   */
  private packBitsCompress(data: Uint8Array): Uint8Array {
    const result: number[] = [];
    let i = 0;

    while (i < data.length) {
      // Look for a run of identical bytes
      let runLength = 1;
      while (i + runLength < data.length && 
             data[i + runLength] === data[i] && 
             runLength < 128) {
        runLength++;
      }

      if (runLength > 2) {
        // Encode as a run: -(runLength - 1), value
        result.push(256 - runLength + 1); // Same as -(runLength - 1) as signed byte
        result.push(data[i]);
        i += runLength;
      } else {
        // Look for literal sequence
        let literalLength = 1;
        while (i + literalLength < data.length && literalLength < 128) {
          // Check if next position starts a run of 3+
          if (i + literalLength + 2 < data.length &&
              data[i + literalLength] === data[i + literalLength + 1] &&
              data[i + literalLength] === data[i + literalLength + 2]) {
            break;
          }
          literalLength++;
        }

        // Encode as literal: length - 1, values...
        result.push(literalLength - 1);
        for (let j = 0; j < literalLength; j++) {
          result.push(data[i + j]);
        }
        i += literalLength;
      }
    }

    return new Uint8Array(result);
  }

  /**
   * Write descriptor block containing brush settings
   */
  private writeDescriptorBlock(brushes: Brush[], uuids: Map<string, string>): Uint8Array {
    const writer = new BinaryWriter();

    // Write descriptor version
    writer.writeUInt32BE(16); // Version 16 is standard for ABR v6+

    // Build the brush list descriptor
    const brushList: DescriptorValue[] = [];

    for (const brush of brushes) {
      const brushDesc = this.createBrushDescriptor(brush, uuids.get(brush.id));
      brushList.push(makeDescriptor.obj('Brsh', brushDesc));
    }

    // Create the root descriptor
    const rootDesc: Record<string, DescriptorValue> = {
      'Brsh': makeDescriptor.list(brushList),
    };

    // Serialize the descriptor
    const serializer = new DescriptorSerializer(writer);
    serializer.serializeDescriptor(rootDesc, '', 'null');

    return writer.toBuffer();
  }

  /**
   * Create a descriptor for a single brush
   */
  private createBrushDescriptor(brush: Brush, uuid?: string): Record<string, DescriptorValue> {
    const desc: Record<string, DescriptorValue> = {};

    // Brush name
    desc['Nm  '] = makeDescriptor.text(brush.name);

    // Brush definition
    const brushDef: Record<string, DescriptorValue> = {};

    // Brush type
    brushDef['brTp'] = makeDescriptor.enum('brTp', brush.type === 'computed' ? 'brtC' : 'brtS');

    // For sampled brushes, include the sampled data UUID
    if (brush.type === 'sampled' && uuid) {
      brushDef['sampledData'] = makeDescriptor.text(uuid);
    }

    // Basic properties
    if (brush.diameter !== undefined) {
      brushDef['Dmtr'] = makeDescriptor.unit('#Pxl', brush.diameter);
    }
    if (brush.hardness !== undefined) {
      brushDef['Hrdn'] = makeDescriptor.unit('#Prc', brush.hardness);
    }
    if (brush.angle !== undefined) {
      brushDef['Angl'] = makeDescriptor.unit('#Ang', brush.angle);
    }
    if (brush.roundness !== undefined) {
      brushDef['Rndn'] = makeDescriptor.unit('#Prc', brush.roundness);
    }
    if (brush.spacing !== undefined) {
      brushDef['Spcn'] = makeDescriptor.unit('#Prc', brush.spacing);
    }

    // For computed brushes, set default shape
    if (brush.type === 'computed') {
      // Default to round shape
      if (!brushDef['Dmtr']) {
        brushDef['Dmtr'] = makeDescriptor.unit('#Pxl', 30);
      }
      if (!brushDef['Hrdn']) {
        brushDef['Hrdn'] = makeDescriptor.unit('#Prc', 100);
      }
    }

    desc['Brsh'] = makeDescriptor.obj('Brsh', brushDef);

    // Spacing at top level too
    desc['Spcn'] = makeDescriptor.unit('#Prc', brush.spacing ?? 25);

    // Include other settings from the original brush if available
    if (brush.settings) {
      this.mergeSettings(desc, brush.settings);
    }

    return desc;
  }

  /**
   * Merge original settings back into descriptor
   */
  private mergeSettings(desc: Record<string, DescriptorValue>, settings: Record<string, unknown>): void {
    // Copy settings that aren't already set
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'Nm  ' || key === 'Brsh' || key === 'Spcn') continue;
      
      const converted = this.convertToDescriptorValue(value);
      if (converted && !desc[key]) {
        desc[key] = converted;
      }
    }
  }

  /**
   * Convert a plain value back to DescriptorValue
   */
  private convertToDescriptorValue(value: unknown): DescriptorValue | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return makeDescriptor.long(value);
      }
      return makeDescriptor.doub(value);
    }

    if (typeof value === 'boolean') {
      return makeDescriptor.bool(value);
    }

    if (typeof value === 'string') {
      return makeDescriptor.text(value);
    }

    if (Array.isArray(value)) {
      const items: DescriptorValue[] = [];
      for (const item of value) {
        const converted = this.convertToDescriptorValue(item);
        if (converted) items.push(converted);
      }
      return makeDescriptor.list(items);
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      
      // Check for enum format
      if ('type' in obj && 'value' in obj && typeof obj.type === 'string') {
        return makeDescriptor.enum(obj.type as string, obj.value as string);
      }

      // Check for unit format
      if ('unit' in obj && 'value' in obj) {
        return makeDescriptor.unit(obj.unit as string, obj.value as number);
      }

      // Otherwise treat as nested object
      const items: Record<string, DescriptorValue> = {};
      for (const [k, v] of Object.entries(obj)) {
        const converted = this.convertToDescriptorValue(v);
        if (converted) items[k] = converted;
      }
      return makeDescriptor.obj('null', items);
    }

    return null;
  }
}

/**
 * Helper function to create a new brush
 */
export function createBrush(params: {
  name: string;
  type?: 'computed' | 'sampled';
  spacing?: number;
  diameter?: number;
  hardness?: number;
  angle?: number;
  roundness?: number;
  brushTip?: BrushTipImage;
}): Brush {
  return {
    id: `brush_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: params.name,
    type: params.type ?? (params.brushTip ? 'sampled' : 'computed'),
    spacing: params.spacing ?? 25,
    diameter: params.diameter,
    hardness: params.hardness,
    angle: params.angle ?? 0,
    roundness: params.roundness ?? 100,
    brushTip: params.brushTip,
    settings: {},
  };
}

/**
 * Helper function to create a new ABR file
 */
export function createAbrFile(brushes: Brush[] = []): AbrFile {
  return {
    version: 6,
    subVersion: 2,
    brushes,
    errors: [],
  };
}

/**
 * Helper to create a brush tip from grayscale image data
 */
export function createBrushTip(width: number, height: number, data: Uint8Array): BrushTipImage {
  return {
    width,
    height,
    depth: 8,
    data,
  };
}
