import type { Place } from './place';

// ============================================================================
// MARK: Types
// ============================================================================

/**
 * A sentinel key used for the gap (dropzone placeholder) in display key lists.
 * This value will never collide with real item keys.
 */
export const GAP_KEY = '__dnd_gap__' as const;
export type GapKey = typeof GAP_KEY;

// ============================================================================
// MARK: computeDisplayKeys
// ============================================================================

/**
 * Compute a display key list from item keys, inserting a gap at the drop position.
 *
 * **Critically, dragged items are kept in the list.** They stay at their original
 * positions so that their DOM nodes persist — this is required for pointer capture
 * to work (the browser cancels pointer capture if the element is removed from DOM).
 *
 * The consumer renders dragged items as collapsed (height: 0, opacity: 0) and the
 * FLIP animation handles the layout transition.
 *
 * This is a **pure function** — no reactivity, no side effects.
 *
 * @param keys          Ordered list of item keys in the container.
 * @param draggedKeys   Set of keys currently being dragged.
 * @param place         Where to insert the gap, or `undefined` for no gap.
 * @param containerKey  The key of this container (to match against `place.parent`).
 * @returns             Array of keys (including dragged) with a gap key inserted.
 *
 * @example
 * ```ts
 * const keys = computeDisplayKeys(
 *   ['a', 'b', 'c', 'd'],
 *   new Set(['b']),
 *   { parent: 'list', before: 'c' },
 *   'list'
 * );
 * // → ['a', 'b', '__dnd_gap__', 'c', 'd']
 * // 'b' stays in the list (render it collapsed), gap inserted before 'c'
 * ```
 */
export function computeDisplayKeys<K>(
  keys: K[],
  draggedKeys: Set<K>,
  place: Place<K> | undefined,
  containerKey: K | string
): (K | GapKey)[] {
  const placeHere = place !== undefined && place.parent === containerKey;
  const result: (K | GapKey)[] = [];
  let gapInserted = false;

  for (const key of keys) {
    if (placeHere && !gapInserted && place!.before === key) {
      result.push(GAP_KEY);
      gapInserted = true;
    }
    result.push(key);
  }

  // Append gap if it wasn't inserted in the loop (before is null or key not found)
  if (placeHere && !gapInserted) {
    result.push(GAP_KEY);
  }

  return result;
}

// ============================================================================
// MARK: computeTreeDisplayKeys
// ============================================================================

/**
 * Compute display key lists for all containers in a tree.
 *
 * @param tree          Tree structure: containerKey → ordered child keys.
 * @param draggedKeys   Set of keys currently being dragged.
 * @param place         Where to insert the gap, or `undefined` for no gap.
 * @returns             Map from container key → display keys.
 *
 * @example
 * ```ts
 * const tree = { root: ['groupA', 'groupB'], groupA: ['x', 'y'], groupB: ['z'] };
 * const displays = computeTreeDisplayKeys(
 *   tree,
 *   new Set(['y']),
 *   { parent: 'groupB', before: 'z' }
 * );
 * // displays['groupA'] → ['x', 'y']          ('y' stays but renders collapsed)
 * // displays['groupB'] → ['__dnd_gap__', 'z']
 * // displays['root']   → ['groupA', 'groupB']
 * ```
 */
export function computeTreeDisplayKeys<K extends string>(
  tree: Record<K | 'root', K[]>,
  draggedKeys: Set<K>,
  place: Place<K> | undefined
): Record<string, (K | GapKey)[]> {
  const result: Record<string, (K | GapKey)[]> = {};

  for (const containerKey of Object.keys(tree) as (K | 'root')[]) {
    const kids = tree[containerKey] ?? [];
    result[containerKey as string] = computeDisplayKeys(kids, draggedKeys, place, containerKey);
  }

  return result;
}
