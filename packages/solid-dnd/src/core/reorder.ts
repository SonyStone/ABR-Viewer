import type { Place } from './types';

// ============================================================================
// MARK: reorderItems
// ============================================================================

/**
 * Pure utility that moves one or more items to a new position in an array.
 *
 * Given an array of items, a set of keys to move, and a target {@link Place},
 * returns a **new** array with the moved items inserted at the target position.
 * The relative order of moved items is preserved (their original order in the array).
 *
 * @param items    The current ordered array.
 * @param movedKeys  Keys of the items to move.
 * @param place    Where to insert — `{ before: key }` or `{ before: null }` (append).
 * @param getKey   Extracts the key from an item.
 * @returns A new array with items reordered.
 *
 * @example
 * ```ts
 * const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
 * const result = reorderItems(items, ['c'], { parent: 'list', before: 'a' }, i => i.id);
 * // → [{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 'd' }]
 * ```
 */
export function reorderItems<K, T>(items: T[], movedKeys: K[], place: Place<K>, getKey: (item: T) => K): T[] {
  const movedSet = new Set(movedKeys);

  // Preserve the original order of moved items
  const moved = items.filter((item) => movedSet.has(getKey(item)));
  if (moved.length === 0) return items;

  const without = items.filter((item) => !movedSet.has(getKey(item)));

  if (place.before === null) {
    return [...without, ...moved];
  }

  const idx = without.findIndex((item) => getKey(item) === place.before);
  if (idx === -1) return [...without, ...moved];

  return [...without.slice(0, idx), ...moved, ...without.slice(idx)];
}
