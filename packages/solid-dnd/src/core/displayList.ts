import { keys } from '@solid-primitives/utils';

import type { Place } from './place';

// ============================================================================
// MARK: Types
// ============================================================================

/**
 * A sentinel key used for the gap (display list placeholder) in display key lists.
 * This value will never collide with real item keys.
 */
export const GAP_KEY = Symbol('dnd_gap');
export type GapKey = typeof GAP_KEY;

export function isGapKey(key: unknown): key is GapKey {
  return key === GAP_KEY;
}

// ============================================================================
// MARK: computeDisplayKeys
// ============================================================================

/**
 * Compute a display key list from item keys, inserting a gap at the drop position.
 *
 * **Dragged items are removed from the output list.** This is safe when the drag
 * sensor uses `proxyCapture: true`, which transfers pointer capture to a hidden
 * proxy element so the source DOM node can be removed without cancelling the drag.
 *
 * A gap sentinel (`GAP_KEY`) is inserted at the current drop position.
 *
 * This is a **pure function** — no reactivity, no side effects.
 *
 * @param keys          Ordered list of item keys in the container.
 * @param draggedKeys   Set of keys currently being dragged (these are excluded).
 * @param place         Where to insert the gap, or `undefined` for no gap.
 * @param containerKey  The key of this container (to match against `place.parent`).
 * @returns             Array of non-dragged keys with a gap key inserted.
 *
 * @example
 * ```ts
 * const keys = computeDisplayKeys(
 *   ['a', 'b', 'c', 'd'],
 *   new Set(['b']),
 *   { parent: 'list', before: 'c' },
 *   'list'
 * );
 * // → ['a', Symbol(dnd_gap), 'c', 'd']
 * // 'b' is removed from the list, gap inserted before 'c'
 * ```
 */
export function computeDisplayKeys<K>(
  keys: ReadonlyArray<K>,
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
    if (!draggedKeys.has(key)) {
      result.push(key);
    }
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
 * Dragged items are removed from their containers' display lists.
 *
 * @param tree          Tree structure: containerKey → ordered child keys.
 * @param draggedKeys   Set of keys currently being dragged (excluded from output).
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
 * // displays['groupA'] → ['x']               ('y' is removed)
 * // displays['groupB'] → ['Symbol(dnd_gap)', 'z']
 * // displays['root']   → ['groupA', 'groupB']
 * ```
 */
export function computeTreeDisplayKeys<K extends string>(
  tree: Record<K | 'root', ReadonlyArray<K>>,
  draggedKeys: Set<K>,
  place: Place<K> | undefined
): Record<string, (K | GapKey)[]> {
  const result: Record<string, (K | GapKey)[]> = {};

  for (const containerKey of keys(tree)) {
    const kids = tree[containerKey] ?? [];
    result[containerKey as string] = computeDisplayKeys(kids, draggedKeys, place, containerKey);
  }

  return result;
}
