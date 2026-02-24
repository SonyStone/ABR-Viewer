import { describe, expect, it } from 'vitest';
import { getListInsertionPoint } from '../../src/core/listInsertion';
import type { Rect } from '../../src/core/rect';

// ============================================================================
// MARK: Helpers
// ============================================================================

/** Creates a rect at (x, y) with given width and height. */
function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, width: w, height: h };
}

/**
 * Builds a vertical stack of rects, each 100×40, starting at y=0.
 *
 * ```
 *   y=0    ┌─── key[0] ───┐  40px tall
 *   y=40   ┌─── key[1] ───┐
 *   y=80   ┌─── key[2] ───┐
 * ```
 */
function stackedRects(keys: string[]): Map<string, Rect> {
  const map = new Map<string, Rect>();
  keys.forEach((key, i) => {
    map.set(key, rect(0, i * 40, 100, 40));
  });
  return map;
}

// ============================================================================
// MARK: Tests
// ============================================================================

describe('getListInsertionPoint', () => {
  // ── Empty list ──────────────────────────────────────────────────────────

  it('returns append for empty key list', () => {
    const result = getListInsertionPoint([], 'container', { x: 50, y: 50 }, () => undefined);
    expect(result).toEqual({ parent: 'container', before: null });
  });

  // ── Single item ─────────────────────────────────────────────────────────

  it('returns before first item when pointer is above center', () => {
    const rects = stackedRects(['a']);
    const result = getListInsertionPoint(
      ['a'],
      'root',
      { x: 50, y: 10 }, // center of 'a' is at y=20
      (key) => rects.get(key)
    );
    expect(result).toEqual({ parent: 'root', before: 'a' });
  });

  it('returns append when pointer is below center of single item', () => {
    const rects = stackedRects(['a']);
    const result = getListInsertionPoint(
      ['a'],
      'root',
      { x: 50, y: 30 }, // center of 'a' is at y=20
      (key) => rects.get(key)
    );
    expect(result).toEqual({ parent: 'root', before: null });
  });

  // ── Multiple items ──────────────────────────────────────────────────────

  it('returns before first item when pointer is above its center', () => {
    // a: y=0..40  center=20
    // b: y=40..80 center=60
    // c: y=80..120 center=100
    const rects = stackedRects(['a', 'b', 'c']);
    const result = getListInsertionPoint(['a', 'b', 'c'], 'list', { x: 50, y: 5 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: 'a' });
  });

  it('returns before second item when pointer is between first and second centers', () => {
    const rects = stackedRects(['a', 'b', 'c']);
    // y=30 is above center of 'b' (60) but below center of 'a' (20)
    const result = getListInsertionPoint(['a', 'b', 'c'], 'list', { x: 50, y: 30 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: 'b' });
  });

  it('returns before third item when pointer is between second and third centers', () => {
    const rects = stackedRects(['a', 'b', 'c']);
    // y=70 is above center of 'c' (100) but below center of 'b' (60)
    const result = getListInsertionPoint(['a', 'b', 'c'], 'list', { x: 50, y: 70 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: 'c' });
  });

  it('returns append when pointer is below all item centers', () => {
    const rects = stackedRects(['a', 'b', 'c']);
    const result = getListInsertionPoint(['a', 'b', 'c'], 'list', { x: 50, y: 110 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: null });
  });

  // ── Exact center ────────────────────────────────────────────────────────

  it('returns append when pointer is exactly at center (not strictly less)', () => {
    const rects = stackedRects(['a']);
    // center of 'a' is exactly y=20. position.y < centerY is false.
    const result = getListInsertionPoint(['a'], 'root', { x: 50, y: 20 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'root', before: null });
  });

  // ── Missing rects ──────────────────────────────────────────────────────

  it('skips items with missing rects', () => {
    // Only 'b' has a rect at y=40..80, center=60
    const rects = new Map<string, Rect>();
    rects.set('b', rect(0, 40, 100, 40));

    const result = getListInsertionPoint(
      ['a', 'b', 'c'],
      'list',
      { x: 50, y: 50 }, // above center of 'b' (60)
      (key) => rects.get(key)
    );
    expect(result).toEqual({ parent: 'list', before: 'b' });
  });

  it('returns append when all rects are missing', () => {
    const result = getListInsertionPoint(['a', 'b', 'c'], 'list', { x: 50, y: 50 }, () => undefined);
    expect(result).toEqual({ parent: 'list', before: null });
  });

  // ── Different container keys ───────────────────────────────────────────

  it('uses the provided parentKey in the result', () => {
    const rects = stackedRects(['item1']);
    const result = getListInsertionPoint(['item1'], 'my-group', { x: 50, y: 5 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'my-group', before: 'item1' });
  });

  // ── Variable-height items ──────────────────────────────────────────────

  it('handles variable-height items correctly', () => {
    const rects = new Map<string, Rect>();
    rects.set('tall', rect(0, 0, 100, 100)); // center = 50
    rects.set('short', rect(0, 100, 100, 20)); // center = 110

    // y=60 is above center of 'tall' (50)? No, 60 > 50. Below center of 'short' (110)? 60 < 110.
    const result = getListInsertionPoint(['tall', 'short'], 'list', { x: 50, y: 60 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: 'short' });
  });

  // ── X position doesn't matter ──────────────────────────────────────────

  it('ignores x position (only uses y for vertical lists)', () => {
    const rects = stackedRects(['a', 'b']);
    // x is way outside, but y=10 is above center of 'a'
    const result = getListInsertionPoint(['a', 'b'], 'list', { x: 999, y: 10 }, (key) => rects.get(key));
    expect(result).toEqual({ parent: 'list', before: 'a' });
  });
});
