/**
 * ABR (Photoshop Brush) File Parser
 * Supports ABR version 6+ (modern format)
 */

import * as fs from 'fs';
import { BinaryReader } from './binary-reader';
import { DescriptorParser, getNumber, getString, getObject, getBoolean } from './descriptor-parser';
import {
  AbrFile,
  Brush,
  BrushTipImage,
  ResourceBlock,
  ParseOptions,
  DescriptorValue,
} from './types';

const PHOTOSHOP_SIGNATURE = '8BIM';
const SAMPLE_KEY = 'samp';
const PATTERN_KEY = 'patt';
const DESCRIPTOR_KEY = 'desc';

export class AbrParser {
  private options: Required<ParseOptions>;

  constructor(options: ParseOptions = {}) {
    this.options = {
      extractImages: options.extractImages ?? true,
      includeRawSettings: options.includeRawSettings ?? true,
      continueOnError: options.continueOnError ?? true,
    };
  }

  /**
   * Parse an ABR file from a file path
   */
  parseFile(filePath: string): AbrFile {
    const buffer = fs.readFileSync(filePath);
    return this.parse(buffer);
  }

  /**
   * Parse an ABR file from a buffer
   */
  parse(buffer: Buffer | Uint8Array): AbrFile {
    // Convert Uint8Array to Buffer if needed
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const reader = new BinaryReader(buf);
    const result: AbrFile = {
      version: 0,
      subVersion: 0,
      brushes: [],
      errors: [],
    };

    try {
      // Read version header
      result.version = reader.readUInt16BE();
      result.subVersion = reader.readUInt16BE();

      // Validate version - we support v6+
      if (result.version < 6) {
        result.errors.push(`Unsupported ABR version: ${result.version}. Only version 6+ is supported.`);
        return result;
      }

      // Parse resource blocks
      const sampleBlocks: ResourceBlock[] = [];
      const descriptorBlocks: ResourceBlock[] = [];
      const patternBlocks: ResourceBlock[] = [];

      while (!reader.isEof() && reader.remaining >= 12) {
        try {
          const block = this.readResourceBlock(reader);
          if (!block) continue;

          switch (block.key) {
            case SAMPLE_KEY:
              sampleBlocks.push(block);
              break;
            case DESCRIPTOR_KEY:
              descriptorBlocks.push(block);
              break;
            case PATTERN_KEY:
              patternBlocks.push(block);
              break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error reading resource block at offset ${reader.position}: ${message}`);
          if (!this.options.continueOnError) throw err;
          break;
        }
      }

      // Parse brush samples (images)
      const brushImages = new Map<string, BrushTipImage>();
      for (const block of sampleBlocks) {
        try {
          const images = this.parseSampleBlock(block.data, result.subVersion);
          for (const [id, image] of images) {
            brushImages.set(id, image);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error parsing sample block: ${message}`);
          if (!this.options.continueOnError) throw err;
        }
      }

      // Parse brush descriptors
      let brushIndex = 0;
      for (const block of descriptorBlocks) {
        try {
          const brushes = this.parseDescriptorBlock(block.data, brushImages, brushIndex);
          brushIndex += brushes.length;
          result.brushes.push(...brushes);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error parsing descriptor block: ${message}`);
          if (!this.options.continueOnError) throw err;
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Fatal error parsing ABR file: ${message}`);
    }

    return result;
  }

  /**
   * Read a single resource block
   */
  private readResourceBlock(reader: BinaryReader): ResourceBlock | null {
    const startPos = reader.position;
    const signature = reader.readString(4);

    if (signature !== PHOTOSHOP_SIGNATURE) {
      // Not a valid block, try to find next one
      reader.seek(startPos + 1);
      return null;
    }

    const key = reader.readString(4);
    const length = reader.readUInt32BE();

    if (reader.remaining < length) {
      throw new Error(`Block length ${length} exceeds remaining data ${reader.remaining}`);
    }

    const data = Buffer.from(reader.readBytes(length));

    return { signature, key, length, data };
  }

  /**
   * Parse a sample block containing brush tip images
   * @param data - The raw sample block data
   * @param subVersion - The ABR subversion (1 or 2)
   */
  private parseSampleBlock(data: Buffer, subVersion: number): Map<string, BrushTipImage> {
    const reader = new BinaryReader(data);
    const images = new Map<string, BrushTipImage>();
    let imageIndex = 0;

    while (!reader.isEof() && reader.remaining >= 4) {
      const brushLength = reader.readUInt32BE();
      if (brushLength === 0 || reader.remaining < brushLength) break;

      const brushStart = reader.position;
      // Pad brush end to 4-byte boundary
      let brushEnd = brushStart + brushLength;
      while (brushEnd % 4 !== 0) brushEnd++;

      try {
        // ABR v6+ sample format (subversion 2):
        // - 38 bytes: UUID string (37 chars) + null terminator
        // - 263 bytes: additional header data  
        // - 16 bytes: bounds (top, left, bottom, right - 4 bytes each)
        // - 2 bytes: depth
        // - 1 byte: compression
        // - variable: image data
        //
        // Total header before bounds: 38 + 263 = 301 bytes
        
        // For subversion 1, the header is smaller (38 + 10 = 48 bytes)
        const headerSize = subVersion === 1 ? 48 : 301;
        
        if (reader.remaining < headerSize + 19) {
          // Not enough data for header + bounds + depth + compression
          reader.seek(brushEnd);
          imageIndex++;
          continue;
        }
        
        // Skip header
        reader.skip(headerSize);
        
        // Read bounds: top, left, bottom, right (each 4 bytes, signed big-endian)
        const top = reader.readUInt32BE();
        const left = reader.readUInt32BE();
        const bottom = reader.readUInt32BE();
        const right = reader.readUInt32BE();
        
        const width = right - left;
        const height = bottom - top;

        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
          reader.seek(brushEnd);
          imageIndex++;
          continue;
        }

        // Bit depth (2 bytes)
        const depth = reader.readUInt16BE();
        
        // Compression type (1 byte): 0 = raw, 1 = RLE
        const compression = reader.readUInt8();
        
        // Validate depth and compression
        if ((depth !== 8 && depth !== 16) || (compression !== 0 && compression !== 1)) {
          // Invalid format, skip this sample
          reader.seek(brushEnd);
          imageIndex++;
          continue;
        }

        // Generate a sample ID for matching with descriptors
        const brushId = `sample_${imageIndex}`;

        // Read image data
        const imageData = new Uint8Array(width * height);

        if (compression === 0) {
          // Uncompressed grayscale
          const bytesPerPixel = depth <= 8 ? 1 : 2;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              if (depth === 8) {
                imageData[y * width + x] = reader.readUInt8();
              } else if (depth === 16) {
                imageData[y * width + x] = reader.readUInt16BE() >> 8;
              }
            }
          }
        } else if (compression === 1) {
          // RLE compressed
          // Read row byte counts first
          const rowByteCounts: number[] = [];
          for (let y = 0; y < height; y++) {
            rowByteCounts.push(reader.readUInt16BE());
          }

          // Decompress each row
          for (let y = 0; y < height; y++) {
            let x = 0;
            const rowEnd = reader.position + rowByteCounts[y];

            while (x < width && reader.position < rowEnd) {
              const count = reader.readInt8();

              if (count >= 0) {
                // Literal run: count + 1 values
                const numValues = count + 1;
                for (let i = 0; i < numValues && x < width; i++) {
                  if (depth === 8) {
                    imageData[y * width + x++] = reader.readUInt8();
                  } else if (depth === 16) {
                    imageData[y * width + x++] = reader.readUInt16BE() >> 8;
                  }
                }
              } else if (count > -128) {
                // Repeat run: 1 - count repetitions of next value
                const numRepeat = 1 - count;
                let value: number;
                if (depth === 8) {
                  value = reader.readUInt8();
                } else {
                  value = reader.readUInt16BE() >> 8;
                }
                for (let i = 0; i < numRepeat && x < width; i++) {
                  imageData[y * width + x++] = value;
                }
              }
              // count === -128 is a no-op
            }

            // Ensure we move to end of row
            reader.seek(rowEnd);
          }
        }

        images.set(brushId, {
          width,
          height,
          depth,
          data: imageData,
        });

      } catch (err) {
        // Skip this brush sample on error
      }

      reader.seek(brushEnd);
      imageIndex++;
    }

    return images;
  }

  /**
   * Parse a descriptor block containing brush settings
   */
  private parseDescriptorBlock(data: Buffer, images: Map<string, BrushTipImage>, startIndex: number): Brush[] {
    const reader = new BinaryReader(data);
    const brushes: Brush[] = [];

    // Descriptor block starts with version (4 bytes)
    const version = reader.readUInt32BE();
    
    // Parse the main descriptor
    const parser = new DescriptorParser(reader);
    
    try {
      const desc = parser.parseDescriptor();
      
      // Extract brush list from the 'Brsh' key which contains VlLs
      const brushList = this.extractBrushList(desc);
      
      // Track which samples have been used (sampled brushes use them in order)
      let sampleIndex = 0;
      
      for (let i = 0; i < brushList.length; i++) {
        const brushDesc = brushList[i];
        try {
          // Check if this is a sampled brush
          const brushDefObj = getObject(brushDesc, 'Brsh');
          let isSampledBrush = false;
          
          if (brushDefObj) {
            const brushType = brushDefObj['brTp'];
            if (brushType && brushType.type === 'enum' && brushType.value === 'brtS') {
              isSampledBrush = true;
            }
            // Also check for sampledData key
            if (brushDefObj['sampledData']) {
              isSampledBrush = true;
            }
          }
          
          const brush = this.createBrush(brushDesc, images, isSampledBrush ? sampleIndex : -1, startIndex + i);
          if (brush) {
            brushes.push(brush);
            if (isSampledBrush && images.has(`sample_${sampleIndex}`)) {
              sampleIndex++;
            }
          }
        } catch (err) {
          // Skip invalid brush
          console.error('Error creating brush:', err);
        }
      }
    } catch (err) {
      console.error('Error parsing descriptor:', err);
      // Try alternate parsing
    }

    return brushes;
  }

  /**
   * Extract brush list from descriptor
   */
  private extractBrushList(desc: Record<string, DescriptorValue>): Record<string, DescriptorValue>[] {
    const result: Record<string, DescriptorValue>[] = [];

    // The brush list is in 'Brsh' key as a VlLs (value list)
    const brsh = desc['Brsh'];
    
    if (brsh && brsh.type === 'VlLs') {
      for (const item of brsh.value) {
        if (item.type === 'Objc') {
          result.push(item.value);
        }
      }
      return result;
    }

    // Alternative keys
    const altKeys = ['prst', 'brushes', 'Ptrn'];
    for (const key of altKeys) {
      const alt = desc[key];
      if (alt && alt.type === 'VlLs') {
        for (const item of alt.value) {
          if (item.type === 'Objc') {
            result.push(item.value);
          }
        }
        return result;
      }
      if (alt && alt.type === 'Objc') {
        result.push(alt.value);
        return result;
      }
    }

    // If no list found, treat entire descriptor as a single brush
    if (result.length === 0 && Object.keys(desc).length > 0) {
      // Check if this looks like a brush preset
      if (desc['Nm  '] || desc['Brsh'] || desc['Dmtr']) {
        result.push(desc);
      }
    }

    return result;
  }

  /**
   * Create a Brush object from parsed descriptor
   */
  private createBrush(
    desc: Record<string, DescriptorValue>,
    images: Map<string, BrushTipImage>,
    sampleIndex: number,
    brushIndex: number
  ): Brush | null {
    // Extract brush ID
    let id = getString(desc, 'Idnt') || getString(desc, 'uuid') || '';
    if (!id) {
      id = `brush_${brushIndex}`;
    }

    // Extract brush name from 'Nm  ' (name) key
    let name = getString(desc, 'Nm  ') || getString(desc, 'name') || 'Unnamed Brush';

    // Get brush definition from 'Brsh' key
    const brushDef = getObject(desc, 'Brsh');
    
    // Determine brush type from brush definition
    let type: 'computed' | 'sampled' = 'sampled';
    let diameter: number | undefined;
    let hardness: number | undefined;
    let angle: number | undefined;
    let roundness: number | undefined;
    let spacing: number | undefined;

    if (brushDef) {
      // Get brush type
      const brushTypeVal = brushDef['brTp'];
      if (brushTypeVal && brushTypeVal.type === 'enum') {
        type = brushTypeVal.value === 'brtC' ? 'computed' : 'sampled';
      }
      
      // Extract properties from brush definition
      diameter = getNumber(brushDef, 'Dmtr');
      hardness = getNumber(brushDef, 'Hrdn');
      angle = getNumber(brushDef, 'Angl');
      roundness = getNumber(brushDef, 'Rndn');
      spacing = getNumber(brushDef, 'Spcn');
    }

    // Fallback to top-level properties
    if (diameter === undefined) diameter = getNumber(desc, 'Dmtr');
    if (hardness === undefined) hardness = getNumber(desc, 'Hrdn');
    if (angle === undefined) angle = getNumber(desc, 'Angl');
    if (roundness === undefined) roundness = getNumber(desc, 'Rndn');
    if (spacing === undefined) spacing = getNumber(desc, 'Spcn');

    // Default spacing
    if (spacing === undefined) spacing = 25;

    // Try to find brush tip image using sample index
    let brushTip: BrushTipImage | undefined;
    
    if (sampleIndex >= 0 && images.has(`sample_${sampleIndex}`)) {
      brushTip = images.get(`sample_${sampleIndex}`);
    }

    const brush: Brush = {
      id,
      name,
      type,
      spacing,
      diameter,
      hardness,
      angle,
      roundness,
      brushTip: this.options.extractImages ? brushTip : undefined,
      settings: this.options.includeRawSettings ? this.flattenDescriptor(desc) : {},
    };

    return brush;
  }

  /**
   * Flatten descriptor to plain object for JSON output
   */
  private flattenDescriptor(desc: Record<string, DescriptorValue>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(desc)) {
      result[key] = this.flattenValue(value);
    }

    return result;
  }

  private flattenValue(value: DescriptorValue): unknown {
    switch (value.type) {
      case 'long':
      case 'doub':
      case 'bool':
      case 'TEXT':
        return value.value;
      case 'enum':
        return { type: value.typeId, value: value.value };
      case 'UntF':
        return { unit: value.unit, value: value.value };
      case 'Objc':
        return this.flattenDescriptor(value.value);
      case 'VlLs':
        return value.value.map(v => this.flattenValue(v));
      case 'tdta':
        return `<binary data: ${value.value.length} bytes>`;
      default:
        return null;
    }
  }
}
