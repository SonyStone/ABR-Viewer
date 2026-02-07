/**
 * Binary Reader - Big-endian reader for Photoshop file formats
 */

export class BinaryReader {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  get position(): number {
    return this.offset;
  }

  get length(): number {
    return this.buffer.length;
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.buffer.length) {
      throw new Error(`Invalid seek offset: ${offset}, buffer length: ${this.buffer.length}`);
    }
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  peek(bytes: number): Buffer {
    return this.buffer.subarray(this.offset, this.offset + bytes);
  }

  readBytes(length: number): Buffer {
    const result = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  readUInt8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt8(): number {
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16BE(): number {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt16BE(): number {
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt32BE(): number {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readInt32BE(): number {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readDoubleBE(): number {
    const value = this.buffer.readDoubleBE(this.offset);
    this.offset += 8;
    return value;
  }

  readFloatBE(): number {
    const value = this.buffer.readFloatBE(this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * Read a fixed-length ASCII string
   */
  readString(length: number): string {
    const bytes = this.readBytes(length);
    // Remove null characters
    let end = bytes.indexOf(0);
    if (end === -1) end = length;
    return bytes.subarray(0, end).toString('ascii');
  }

  /**
   * Read a Pascal string (1-byte length prefix)
   */
  readPascalString(): string {
    const length = this.readUInt8();
    if (length === 0) return '';
    return this.readString(length);
  }

  /**
   * Read a Unicode string (4-byte length prefix, big-endian UTF-16)
   */
  readUnicodeString(): string {
    const length = this.readUInt32BE();
    if (length === 0) return '';
    
    const chars: string[] = [];
    for (let i = 0; i < length; i++) {
      const charCode = this.readUInt16BE();
      if (charCode !== 0) {
        chars.push(String.fromCharCode(charCode));
      }
    }
    return chars.join('');
  }

  /**
   * Read a Photoshop-style ID (4-byte or length-prefixed)
   */
  readId(): string {
    const length = this.readUInt32BE();
    if (length === 0) {
      // 4-byte key
      return this.readString(4);
    }
    return this.readString(length);
  }

  /**
   * Check if we're at or past the end of the buffer
   */
  isEof(): boolean {
    return this.offset >= this.buffer.length;
  }

  /**
   * Get a slice of the buffer from current position
   */
  slice(length: number): Buffer {
    return this.buffer.subarray(this.offset, this.offset + length);
  }

  /**
   * Create a new reader from a slice of this buffer
   */
  subReader(length: number): BinaryReader {
    const subBuffer = this.readBytes(length);
    return new BinaryReader(Buffer.from(subBuffer));
  }
}
