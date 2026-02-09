# ABR Brush Editor - Implementation Specification

This project consists of two parts:

1. **ABR Parser** - Parsing and writing Adobe Photoshop brush files (`.abr`)
2. **Web Editor** - Browser-based brush editor with Photoshop-like UI

## Test Files

| File                                 | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `Brushes To Implement.abr`           | Contains presumably all possible brush types/settings |
| `Brushes To Implement Roundtrip.abr` | Same file after parser-write roundtrip (for testing)  |

---

## ✅ Completed Features

### Parser

- [x] Parse ABR files (v6, v9, v10)
- [x] Write/save ABR files
- [x] Roundtrip tests (parse → write → parse)

### Web Editor

- [x] Load ABR files
- [x] View brush list with previews
- [x] Rename brushes

---

## 🚧 Features To Implement

### Brush Organization

#### Brush Groups

- [ ] Create groups and sub-groups
- [ ] Edit/rename groups
- [ ] Drag-and-drop sorting (brushes & groups)
- [ ] Move brushes between groups/sub-groups
- [ ] Consider: Global brush list to move brushes between `.abr`'s groups/sub-groups

**Libraries to evaluate:** `@thisbeyond/solid-dnd`, `solidjs-use`

#### Reset Functionality

- [ ] Reset button for each input or panel
- [ ] Define default values: from loaded `.abr` vs input defaults?

---

### Tool Types

Each tool has specific settings and available brush panels. See individual tool documentation:

| Tool                   | Documentation                                                                               | Status        |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------- |
| Brush Tool             | [Brush-Tool.md](./Tools/Brush%20Tool%20/Brush-Tool.md)                                      | 📝 Documented |
| Pencil Tool            | [Pencil-Tool.md](./Tools/Pencil%20Tool%20/Pencil-Tool.md)                                   | 📝 Documented |
| Mixer Brush Tool       | [Mixer-Brush-Tool.md](./Tools/Mixer%20Brush%20Tool%20/Mixer-Brush-Tool.md)                  | 📝 Documented |
| Clone Stamp Tool       | [Clone-Stamp-Tool.md](./Tools/Clone%20Stamp%20Tool%20/Clone-Stamp-Tool.md)                  | 📝 Documented |
| History Brush Tool     | [History-Brush-Tool.md](./Tools/History%20Brush%20Tool%20/History-Brush-Tool.md)            | 📝 Documented |
| Art History Brush Tool | [Art-History-Brush-Tool.md](./Tools/Art%20History%20Brush%20Tool/Art-History-Brush-Tool.md) | 📝 Documented |
| Eraser Tool            | [Eraser-Tool.md](./Tools/Eraser%20Tool%20/Eraser-Tool.md)                                   | 📝 Documented |
| Blur Tool              | [Blur-Tool.md](./Tools/Blur%20Tool/Blur-Tool.md)                                            | 📝 Documented |
| Sharpen Tool           | [Sharpen-Tool.md](./Tools/Sharpen%20Tool%20/Sharpen-Tool.md)                                | 📝 Documented |
| Smudge Tool            | [Smudge-Tool.md](./Tools/Smudge%20Tool%20/Smudge-Tool.md)                                   | 📝 Documented |
| Dodge Tool             | [Dodge-Tool.md](./Tools/Dodge%20Tool%20/Dodge-Tool.md)                                      | 📝 Documented |
| Burn Tool              | [Burn-Tool.md](./Tools/Burn%20Tool%20/Burn-Tool.md)                                         | 📝 Documented |
| Sponge Tool            | [Sponge-Tool.md](./Tools/Sponge%20Tool%20/Sponge-Tool.md)                                   | 📝 Documented |

---

### Common Settings Documentation

Shared settings used across multiple tools:

| Setting            | Documentation                                                  |
| ------------------ | -------------------------------------------------------------- |
| Blend Modes        | [Blend-Modes.md](./Tools/_Common/Blend-Modes.md)               |
| Control Options    | [Control-Options.md](./Tools/_Common/Control-Options.md)       |
| Non-Linear Sliders | [Non-Linear-Sliders.md](./Tools/_Common/Non-Linear-Sliders.md) |
| Brush Tip Shape    | [Brush-Tip-Shape.md](./Tools/_Common/Brush-Tip-Shape.md)       |
| Shape Dynamics     | [Shape-Dynamics.md](./Tools/_Common/Shape-Dynamics.md)         |
| Scattering         | [Scattering.md](./Tools/_Common/Scattering.md)                 |
| Texture            | [Texture.md](./Tools/_Common/Texture.md)                       |
| Dual Brush         | [Dual-Brush.md](./Tools/_Common/Dual-Brush.md)                 |
| Color Dynamics     | [Color-Dynamics.md](./Tools/_Common/Color-Dynamics.md)         |
| Transfer           | [Transfer.md](./Tools/_Common/Transfer.md)                     |
| Brush Pose         | [Brush-Pose.md](./Tools/_Common/Brush-Pose.md)                 |
| Smoothing Options  | [Smoothing-Options.md](./Tools/_Common/Smoothing-Options.md)   |
| Symmetry Options   | [Symmetry-Options.md](./Tools/_Common/Symmetry-Options.md)     |

---

### Brush Settings Panels

#### Panel Checkboxes (Left Sidebar)

Each panel has:

- **Checkbox** - Enable/disable the feature
- **Lock icon (🔒)** - Preserve setting when switching brushes

#### Quick Toggle Settings

These appear in sidebar but have no expanded panel (just checkboxes):

- `Noise` - Adds grain to brush edges
- `Wet Edges` - Watercolor edge effect
- `Build-up` - Airbrush opacity accumulation
- `Smoothing` - Enable stroke smoothing
- `Protect Texture` - Use same texture for all brushes

**Note:** Remove these from "Right Panel - Settings Content" in current implementation.

---

### Specific Settings To Implement

#### Spacing Checkbox

- Like in Photoshop, allow disabling spacing for speed-based stamp placement

#### Brush Tip Image

- [ ] View current brush tip image
- [ ] Replace/upload new brush tip image
- [ ] For Dual Brush: upload secondary brush tip

#### Preset Save Options

- [ ] `Capture Brush Size in Preset`
- [ ] `Include Tool Settings`
- [ ] `Include Color` (Brush Tool, Pencil Tool, Mixer Brush Tool only)

---

### Tool-Specific Settings

#### Clone Stamp / History Brush

- `Aligned` - Checkbox
- `Sample` → `Current Layer` | `Current & Below` | `All Layers`

---

## Tool Panel Availability Matrix

| Panel           | Brush | Pencil | Mixer | Clone | Eraser | Blur | Smudge | Dodge | Burn | Sponge |
| --------------- | ----- | ------ | ----- | ----- | ------ | ---- | ------ | ----- | ---- | ------ |
| Brush Tip Shape | ✅    | ✅     | ✅    | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Shape Dynamics  | ✅    | ✅     | ✅    | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Scattering      | ✅    | ✅     | ✅    | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Texture         | ✅    | ✅     | ✅    | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Dual Brush      | ✅    | ✅     | ❌    | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Color Dynamics  | ✅    | ✅     | ❌    | ✅    | ✅     | ❌   | ❌     | ❌    | ❌   | ❌     |
| Transfer        | ✅    | ✅     | ✅\*  | ✅    | ✅     | ✅   | ✅     | ✅    | ✅   | ✅     |
| Brush Pose      | ✅    | ✅     | ✅    | ✅    | ❌     | ❌   | ❌     | ❌    | ❌   | ❌     |

\*Mixer Brush has additional Wetness Jitter and Mix Jitter in Transfer

---

## Implementation Priority

### Phase 1: Core Brush Editor

1. Brush Tip Shape (all settings)
2. Toolbar: Opacity, Flow, Size
3. Shape Dynamics
4. Transfer

### Phase 2: Advanced Dynamics

1. Scattering
2. Texture
3. Dual Brush
4. Color Dynamics

### Phase 3: Organization & Polish

1. Brush groups & drag-drop
2. Brush Pose
3. Smoothing with options
4. Symmetry

### Phase 4: Multi-Tool Support

1. Pencil Tool
2. Eraser Tool
3. Clone Stamp Tool
4. Remaining tools
