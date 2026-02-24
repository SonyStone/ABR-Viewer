import type { Place } from './place';
import type { Rect } from './rect';
import type { Vec2 } from './vec2';

// ============================================================================
// MARK: getListInsertionPoint
// ============================================================================

/**
 * Finds the insertion point within a vertical list of items based on pointer position.
 *
 * Uses the vertical center-line algorithm: for each item, if the pointer is above
 * the item's vertical center, the insertion point is "before" that item. If the
 * pointer is below all item centers, the result is "append" (`before: null`).
 *
 * This is the shared logic used by both `createSortable` (list mode) and
 * `createNestable` (per-container insertion).
 *
 * ## How it works
 *
 * ```
 *   ──── before A ────
 *   ┌──────────────┐
 *   │      A       │  ← centerY = rect.y + rect.height / 2
 *   └──────────────┘
 *   ──── before B ────
 *   ┌──────────────┐
 *   │      B       │
 *   └──────────────┘
 *   ──── append ──────
 * ```
 *
 * @param keys     Active (non-dragged) item keys in display order.
 * @param parentKey  The container key — used as `parent` in the returned Place.
 * @param position   Current pointer position (same coordinate space as rects).
 * @param getRect    Returns the bounding rect for an item, or `undefined` if unmeasured.
 * @returns The best insertion Place. Always returns a value (never `undefined`).
 *
 * @example
 * ```ts
 * const place = getListInsertionPoint(
 *   ['a', 'b', 'c'],
 *   'container',
 *   { x: 100, y: 150 },
 *   (key) => rects.get(key),
 * );
 * // → { parent: 'container', before: 'b' }
 * ```
 */
export function getListInsertionPoint<K>(
  keys: K[],
  parentKey: K,
  position: Vec2,
  getRect: (key: K) => Rect | undefined
): Place<K> {
  // Empty list → append
  if (keys.length === 0) {
    return { parent: parentKey, before: null };
  }

  // Find the first item whose vertical center is below the pointer
  for (let i = 0; i < keys.length; i++) {
    const rect = getRect(keys[i]);
    if (!rect) continue;

    const centerY = rect.y + rect.height / 2;
    if (position.y < centerY) {
      return { parent: parentKey, before: keys[i] };
    }
  }

  // Below all items → append at end
  return { parent: parentKey, before: null };
}
