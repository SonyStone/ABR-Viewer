import { getGridIndicatorPosition, getGridInsertionPoint } from 'src/core/gridInsertion';
import { type ResolvedGrid } from 'src/core/gridLayout';
import * as Rect from 'src/core/rect';
import * as Vec2 from 'src/core/vec2';
import { describe, expect, it } from 'vitest';

// ============================================================================
// MARK: Test Helpers
// ============================================================================

/**
 * Standard 4-column grid layout:
 *
 * ```
 * Container: (10, 10, 440, 200)
 *
 * columns: 4, columnWidth: 100, rowHeight: 80, gap: [10, 10]
 *
 *  ┌──────────────────────────────────────────────────┐ (10,10)
 *  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
 *  │ │  a   │ │  b   │ │  c   │ │  d   │  row 0     │
 *  │ └──────┘ └──────┘ └──────┘ └──────┘            │
 *  │                                                  │
 *  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
 *  │ │  e   │ │  f   │ │  g   │ │  h   │  row 1     │
 *  │ └──────┘ └──────┘ └──────┘ └──────┘            │
 *  └──────────────────────────────────────────────────┘
 * ```
 *
 * Cell positions (x, y):
 *   a: (10, 10)    b: (120, 10)    c: (230, 10)    d: (340, 10)
 *   e: (10, 100)   f: (120, 100)   g: (230, 100)   h: (340, 100)
 */
function standardGridSetup() {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const grid: ResolvedGrid = {
    columns: 4,
    columnWidth: 100,
    rowHeight: 80,
    rowGap: 10,
    colGap: 10,
    rows: 2
  };

  const containerRect = Rect.of(10, 10, 440, 190);

  // Build item rects from grid math
  const itemRects = new Map<string, Rect.Rect>();
  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    itemRects.set(
      items[i],
      Rect.of(
        10 + col * 110, // origin.x + col * (width + gap)
        10 + row * 90, // origin.y + row * (height + gap)
        100,
        80
      )
    );
  }

  const getRectForItem = (key: string) => itemRects.get(key);

  return { items, grid, containerRect, itemRects, getRectForItem };
}

// ============================================================================
// MARK: getGridInsertionPoint
// ============================================================================

describe('getGridInsertionPoint', () => {
  it('pointer outside container → undefined', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridInsertionPoint(Vec2.of(-100, -100), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toBeUndefined();
  });

  it('empty grid → append', () => {
    const { grid, containerRect } = standardGridSetup();
    const result = getGridInsertionPoint(Vec2.of(50, 50), 'grid', [], grid, containerRect);
    expect(result).toEqual({ parent: 'grid', before: null });
  });

  it('pointer in left half of first item → before a', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // First item center x = 10 + 50 = 60. Pointer at x=40 → left half
    const result = getGridInsertionPoint(Vec2.of(40, 50), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: 'a' });
  });

  it('pointer in right half of first item → before b', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // First item center x = 60. Pointer at x=80 → right half
    const result = getGridInsertionPoint(Vec2.of(80, 50), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: 'b' });
  });

  it('pointer in left half of second item → before b', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // b rect starts at x=120, center=170. Pointer at x=140 → left half
    const result = getGridInsertionPoint(Vec2.of(140, 50), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: 'b' });
  });

  it('pointer in right half of last item in row → before e (next row)', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // d rect: (340, 10, 100, 80), center x = 390. Pointer at x=400 → right half
    const result = getGridInsertionPoint(Vec2.of(400, 50), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: 'e' });
  });

  it('pointer in second row left half → before e', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // e rect: (10, 100, 100, 80), center x = 60. Pointer at x=40, y=140
    const result = getGridInsertionPoint(Vec2.of(40, 140), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: 'e' });
  });

  it('pointer after last item → append', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    // h rect: (340, 100, 100, 80), center x = 390. Pointer at x=410 → right half → append
    const result = getGridInsertionPoint(Vec2.of(410, 140), 'grid', items, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: null });
  });

  it('pointer beyond last row → append', () => {
    const { grid, containerRect, getRectForItem } = standardGridSetup();
    // Partial last row: 5 items in 4 columns = 1 in row 1
    const items5 = ['a', 'b', 'c', 'd', 'e'];
    const result = getGridInsertionPoint(Vec2.of(300, 140), 'grid', items5, grid, containerRect, getRectForItem);
    expect(result).toEqual({ parent: 'grid', before: null });
  });

  it('works without getRectForItem (uses computed cell rects)', () => {
    const { items, grid, containerRect } = standardGridSetup();
    // Left half of cell (0,0) → center x = 10 + 50 = 60, pointer at x=30
    const result = getGridInsertionPoint(Vec2.of(30, 50), 'grid', items, grid, containerRect);
    expect(result).toEqual({ parent: 'grid', before: 'a' });
  });

  it('right half without getRectForItem → before next item', () => {
    const { items, grid, containerRect } = standardGridSetup();
    // Right half of cell (0,0) → center x = 10 + 50 = 60, pointer at x=70
    const result = getGridInsertionPoint(Vec2.of(70, 50), 'grid', items, grid, containerRect);
    expect(result).toEqual({ parent: 'grid', before: 'b' });
  });
});

// ============================================================================
// MARK: getGridIndicatorPosition
// ============================================================================

describe('getGridIndicatorPosition', () => {
  it('undefined place → undefined', () => {
    const { items, grid, containerRect } = standardGridSetup();
    const result = getGridIndicatorPosition(undefined, items, grid, containerRect);
    expect(result).toBeUndefined();
  });

  it('empty items → origin position', () => {
    const { grid, containerRect } = standardGridSetup();
    const result = getGridIndicatorPosition({ parent: 'grid', before: null }, [], grid, containerRect);
    expect(result).toEqual({ x: 0, y: 0, height: 80 });
  });

  it('before first item → left edge of first cell', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridIndicatorPosition(
      { parent: 'grid', before: 'a' },
      items,
      grid,
      containerRect,
      getRectForItem
    );
    // a rect: (10, 10, 100, 80), container origin: (10, 10)
    expect(result).toEqual({ x: 0, y: 0, height: 80 });
  });

  it('before second item → left edge of second cell', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridIndicatorPosition(
      { parent: 'grid', before: 'b' },
      items,
      grid,
      containerRect,
      getRectForItem
    );
    // b rect: (120, 10, 100, 80), container origin: (10, 10) → x=110
    expect(result).toEqual({ x: 110, y: 0, height: 80 });
  });

  it('before item in second row', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridIndicatorPosition(
      { parent: 'grid', before: 'f' },
      items,
      grid,
      containerRect,
      getRectForItem
    );
    // f rect: (120, 100, 100, 80), container origin: (10, 10) → x=110, y=90
    expect(result).toEqual({ x: 110, y: 90, height: 80 });
  });

  it('append → right edge of last item', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridIndicatorPosition(
      { parent: 'grid', before: null },
      items,
      grid,
      containerRect,
      getRectForItem
    );
    // h rect: (340, 100, 100, 80), right edge = 440, container origin: (10, 10) → x=430, y=90
    expect(result).toEqual({ x: 430, y: 90, height: 80 });
  });

  it('unknown item key → undefined', () => {
    const { items, grid, containerRect, getRectForItem } = standardGridSetup();
    const result = getGridIndicatorPosition(
      { parent: 'grid', before: 'nonexistent' },
      items,
      grid,
      containerRect,
      getRectForItem
    );
    expect(result).toBeUndefined();
  });

  it('fallback to grid math when no getRectForItem', () => {
    const { items, grid, containerRect } = standardGridSetup();
    const result = getGridIndicatorPosition({ parent: 'grid', before: 'c' }, items, grid, containerRect);
    // c is index 2, cell (0, 2) → x = 2 * (100 + 10) = 220, y = 0
    expect(result).toEqual({ x: 220, y: 0, height: 80 });
  });

  it('append fallback without getRectForItem', () => {
    const { items, grid, containerRect } = standardGridSetup();
    const result = getGridIndicatorPosition({ parent: 'grid', before: null }, items, grid, containerRect);
    // Last item index 7, cell (1, 3) → x = 3 * 110 + 100 = 430, y = 90
    expect(result).toEqual({ x: 430, y: 90, height: 80 });
  });
});
