# ABR Format Research

This document describes how the ABR file format was reverse-engineered to create this parser.

## Research Methodology

### 1. Hex Dump Analysis

The first step was examining the raw binary data of the sample ABR files using hex dumps:

```bash
xxd files/MainBrushes.abr | head -100
```

This revealed:
- Files start with version bytes (e.g., `00 06 00 02` for v6.2)
- The signature `8BIM` appears repeatedly, indicating Photoshop resource blocks
- ASCII strings like `samp`, `patt`, `desc` identify different block types

### 2. Version Identification

By examining the first 4 bytes of each file:

| File | Bytes | Version |
|------|-------|---------|
| MainBrushes.abr | `00 06 00 02` | v6.2 |
| Basic_3.abr | `00 06 00 02` | v6.2 |
| AI_Brush_collection.abr | `00 0a 00 01` | v10.1 |
| 0 MH 8B Brushes.abr | `00 09 00 01` | v9.1 |

This showed the format: `[major version: 2 bytes] [minor version: 2 bytes]`

### 3. Resource Block Structure

Pattern matching for `8BIM` signatures revealed the resource block format:

```
Offset  Size  Description
0       4     Signature "8BIM"
4       4     Block type key (e.g., "samp", "desc", "patt")
8       4     Block data length (big-endian)
12      N     Block data
```

Verification with hex dumps:
```
38 42 49 4d = "8BIM"
73 61 6d 70 = "samp" (sample/brush tip images)
64 65 73 63 = "desc" (descriptor/brush settings)
70 61 74 74 = "patt" (patterns)
```

### 4. Descriptor Format Discovery

The `desc` blocks contain brush settings in Photoshop's descriptor format. Key discoveries:

1. **Unicode String Prefix**: Each descriptor starts with a Unicode string (class name) before the class ID
2. **Item Structure**: Class ID + item count + key/value pairs
3. **Type Tags**: 4-character codes indicate value types:
   - `TEXT` = Unicode string
   - `long` = 32-bit integer
   - `doub` = 64-bit double
   - `bool` = Boolean
   - `UntF` = Unit float (with unit type)
   - `enum` = Enumeration
   - `Objc` = Nested object
   - `VlLs` = Value list (array)
   - `tdta` = Raw data

### 5. Sample Block Structure (Critical Discovery)

The most challenging part was parsing the `samp` blocks containing brush tip images.

#### Initial Approach
Expected simple structure: bounds → depth → compression → image data

#### Debug Process
Created debug scripts to search for known values:
- Image depth should be 8 (grayscale)
- Compression should be 0 (raw) or 1 (RLE)

```typescript
// Search for byte value 8 followed by 0 or 1
for (let i = 0; i < data.length - 2; i++) {
  if (data[i] === 0 && data[i+1] === 8 && (data[i+2] === 0 || data[i+2] === 1)) {
    // Potential depth/compression location
  }
}
```

#### Key Discovery: 301-Byte Header

By searching for patterns, found that the image bounds start at offset **301** from the sample block start:

```
Offset  Size  Description
0       4     Sample length
4       38    UUID string (37 chars + null terminator)
42      259   Unknown header data (possibly brush metadata)
301     4     Top bound
305     4     Left bound
309     4     Bottom bound
313     4     Right bound
317     2     Depth (8 = grayscale)
319     1     Compression (0=raw, 1=RLE)
320     N     Image data
```

Validation: Reading bounds at offset 301 gave sensible image dimensions (e.g., 256x256, 512x512).

### 6. Image Data Decompression

#### RLE (PackBits) Compression

Photoshop uses PackBits RLE compression:
- Each scanline has a 2-byte length prefix
- Compressed data follows standard PackBits algorithm:
  - `n >= 0`: Copy next `n+1` bytes literally
  - `n < 0` (and n ≠ -128): Repeat next byte `-n+1` times
  - `n = -128`: No operation

### 7. Version Differences

Testing across multiple files revealed version-specific behavior:

| Version | Sample Header Size | Notes |
|---------|-------------------|-------|
| v6.2 | 301 bytes | Most common format |
| v9.x | 301 bytes | Same as v6.2 |
| v10.x | 301 bytes | Same as v6.2 |
| v1/v2 | 48 bytes | Legacy format (estimated) |

## Information Sources

### Primary Sources (Direct Analysis)
1. **Sample ABR files** - 9 files provided as test cases
2. **Hex dump analysis** - Raw binary examination
3. **Pattern matching** - Searching for signatures and known values
4. **Trial and error** - Testing different offset values

### Secondary Sources (Reference)
1. **Adobe Photoshop file format specifications** - General structure patterns
2. **Open-source implementations** - GIMP ABR import code provides hints about format
3. **Photoshop SDK documentation** - Descriptor format is documented in Adobe's SDK

## Key Insights

### Big-Endian Byte Order
All multi-byte values in ABR files use big-endian byte order (most significant byte first), consistent with Photoshop's Mac heritage.

### Unicode Strings
Photoshop uses UCS-2/UTF-16BE encoding for Unicode strings, with a 4-byte length prefix indicating character count (not byte count).

### Grayscale Images
Brush tips are stored as 8-bit grayscale images where:
- 0 = Transparent (no paint)
- 255 = Fully opaque (full paint)

### Computed vs Sampled Brushes
Not all brushes have bitmap images. "Computed" brushes (like hard/soft round) are defined by parameters and generated algorithmically.

## Verification

The parser was validated against all 9 sample files:

| File | Brushes | Images | Status |
|------|---------|--------|--------|
| 0 MH 8B Brushes.abr | 23 | 23 | ✅ |
| AI_Brush_collection.abr | 5 | 5 | ✅ |
| Basic_3.abr | 6 | 0 | ✅ (computed) |
| CGCookie_BasicBrushes.abr | 5 | 5 | ✅ |
| Chunky_Chalk_Brush_by_MarkWinters.abr | 1 | 1 | ✅ |
| CtrlPaint - Digital Sketching.abr | 1 | 1 | ✅ |
| Driver_drow.abr | 2 | 2 | ✅ |
| MainBrushes.abr | 14 | 11 | ✅ |
| Paint_markers_brush_set_by_LDN755.abr | 38 | 20 | ✅ |

Total: 95 brushes parsed, 68 images exported.
