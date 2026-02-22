import { describe, expect, it } from 'vitest';
import { computeDisplayKeys, computeTreeDisplayKeys, GAP_KEY } from '../../src/core/displayList';

// ============================================================================
// MARK: computeDisplayKeys
// ============================================================================

describe('computeDisplayKeys', () => {
  const keys = ['a', 'b', 'c', 'd'];

  it('returns all items when nothing is dragged and no place', () => {
    const result = computeDisplayKeys(keys, new Set(), undefined, 'list');
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps dragged items in the list when no place', () => {
    const result = computeDisplayKeys(keys, new Set(['b']), undefined, 'list');
    // Dragged items stay — consumer renders them collapsed
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps dragged items and inserts gap before a specific key', () => {
    const result = computeDisplayKeys(keys, new Set(['b']), { parent: 'list', before: 'c' }, 'list');
    // 'b' stays in list, gap inserted before 'c'
    expect(result).toEqual(['a', 'b', GAP_KEY, 'c', 'd']);
  });

  it('appends gap when before is null', () => {
    const result = computeDisplayKeys(keys, new Set(['b']), { parent: 'list', before: null }, 'list');
    expect(result).toEqual(['a', 'b', 'c', 'd', GAP_KEY]);
  });

  it('inserts gap before first item', () => {
    const result = computeDisplayKeys(keys, new Set(['c']), { parent: 'list', before: 'a' }, 'list');
    expect(result).toEqual([GAP_KEY, 'a', 'b', 'c', 'd']);
  });

  it('ignores place when parent does not match containerKey', () => {
    const result = computeDisplayKeys(keys, new Set(['b']), { parent: 'other-container', before: 'c' }, 'list');
    // No gap inserted, all keys present
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles multiple dragged keys', () => {
    const result = computeDisplayKeys(keys, new Set(['a', 'c']), { parent: 'list', before: 'd' }, 'list');
    // Both 'a' and 'c' stay, gap before 'd'
    expect(result).toEqual(['a', 'b', 'c', GAP_KEY, 'd']);
  });

  it('handles empty list with append place', () => {
    const result = computeDisplayKeys([], new Set<string>(), { parent: 'list', before: null }, 'list');
    expect(result).toEqual([GAP_KEY]);
  });

  it('handles all items dragged with append place', () => {
    const result = computeDisplayKeys(keys, new Set(['a', 'b', 'c', 'd']), { parent: 'list', before: null }, 'list');
    // All keys stay (rendered collapsed), gap appended
    expect(result).toEqual(['a', 'b', 'c', 'd', GAP_KEY]);
  });

  it('inserts gap before a dragged key if place.before references it', () => {
    const result = computeDisplayKeys(['a', 'b', 'c'], new Set(['b']), { parent: 'list', before: 'b' }, 'list');
    // Gap inserted before 'b' (even though 'b' is dragged)
    expect(result).toEqual(['a', GAP_KEY, 'b', 'c']);
  });

  it('preserves original order with dragged items', () => {
    const result = computeDisplayKeys(
      ['x', 'y', 'z', 'w'],
      new Set(['y', 'w']),
      { parent: 'list', before: 'z' },
      'list'
    );
    // 'y' and 'w' stay in list, gap before 'z'
    expect(result).toEqual(['x', 'y', GAP_KEY, 'z', 'w']);
  });

  it('only inserts one gap', () => {
    const result = computeDisplayKeys(['a', 'b'], new Set<string>(), { parent: 'list', before: 'a' }, 'list');
    expect(result).toEqual([GAP_KEY, 'a', 'b']);
    expect(result.filter((k) => k === GAP_KEY)).toHaveLength(1);
  });
});

// ============================================================================
// MARK: computeTreeDisplayKeys
// ============================================================================

describe('computeTreeDisplayKeys', () => {
  const tree = {
    root: ['groupA', 'groupB'] as string[],
    groupA: ['x', 'y'] as string[],
    groupB: ['z'] as string[]
  };

  it('returns all items with no drag state', () => {
    const result = computeTreeDisplayKeys(tree, new Set(), undefined);
    expect(result['root']).toEqual(['groupA', 'groupB']);
    expect(result['groupA']).toEqual(['x', 'y']);
    expect(result['groupB']).toEqual(['z']);
  });

  it('keeps dragged item in its container', () => {
    const result = computeTreeDisplayKeys(tree, new Set(['y']), undefined);
    // 'y' stays in groupA
    expect(result['groupA']).toEqual(['x', 'y']);
    expect(result['groupB']).toEqual(['z']);
  });

  it('keeps dragged item and inserts gap in target container', () => {
    const result = computeTreeDisplayKeys(tree, new Set(['y']), { parent: 'groupB', before: 'z' });
    // 'y' stays in groupA (rendered collapsed)
    expect(result['groupA']).toEqual(['x', 'y']);
    // Gap inserted in groupB before 'z'
    expect(result['groupB']).toEqual([GAP_KEY, 'z']);
    expect(result['root']).toEqual(['groupA', 'groupB']);
  });

  it('inserts gap at append position', () => {
    const result = computeTreeDisplayKeys(tree, new Set(['x']), { parent: 'groupB', before: null });
    expect(result['groupA']).toEqual(['x', 'y']);
    expect(result['groupB']).toEqual(['z', GAP_KEY]);
  });

  it('moves group between root-level positions', () => {
    const result = computeTreeDisplayKeys(tree, new Set(['groupA']), { parent: 'root', before: null });
    // groupA stays in root, gap appended
    expect(result['root']).toEqual(['groupA', 'groupB', GAP_KEY]);
    // groupA's children unchanged
    expect(result['groupA']).toEqual(['x', 'y']);
  });
});

// ============================================================================
// MARK: GAP_KEY
// ============================================================================

describe('GAP_KEY', () => {
  it('is a recognizable constant', () => {
    expect(GAP_KEY).toBe('__dnd_gap__');
  });
});
