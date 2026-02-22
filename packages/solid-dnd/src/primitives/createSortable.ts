import { type Accessor, createMemo } from 'solid-js';
import type { Place } from '../core/place';
import type { Rect } from '../core/rect';
import type { Vec2 } from '../core/vec2';

// ============================================================================
// MARK: Types
// ============================================================================

export type SortableOptions<K> = {
  /** The key of the container these items belong to. */
  containerKey: K;
  /** Accessor returning the ordered list of item keys. */
  items: Accessor<K[]>;
  /** Returns the bounding rect for an item by its key. */
  getRect: (key: K) => Rect | undefined;
  /** Returns the bounding rect for the container element. */
  getContainerRect: () => Rect | undefined;
  /**
   * Layout mode for insertion point calculation.
   * Currently only 'list' (vertical) is supported. Grid comes in M6.
   * @default 'list'
   */
  layout?: 'list';
  /**
   * Spacing between items in pixels. Used as a hint for indicator placement,
   * but does not affect insertion point detection (rects already include gaps).
   * @default 0
   */
  spacing?: number;
  /**
   * Keys currently being dragged. These are excluded from insertion point
   * calculations so the dragged item's own rect doesn't interfere.
   */
  draggedKeys?: Accessor<K[]>;
};

export type Sortable<K> = {
  /**
   * Given a pointer position (in the same coordinate space as the rects),
   * returns the best insertion point, or `undefined` if the pointer is
   * outside the container bounds.
   *
   * For a vertical list, the boundary between "before item[i]" and
   * "before item[i+1]" is at the vertical center of item[i]'s rect.
   */
  getInsertionPoint: (position: Vec2) => Place<K> | undefined;
  /**
   * Returns the Y offset (relative to the container's top) where a drop
   * indicator should be drawn for the given insertion `place`.
   *
   * - `before: key` → top edge of that item's rect, relative to container.
   * - `before: null` (append) → bottom edge of the last item, relative to container.
   * - Returns `undefined` if the place is undefined, the container has no rect,
   *   or the referenced item has no rect.
   */
  getIndicatorOffset: (place: Place<K> | undefined) => number | undefined;
  /**
   * All valid insertion points for the current item list.
   * For N items, returns N+1 places: before each item + append at end.
   * Useful for rendering drop indicators at every possible position.
   */
  insertionPoints: Accessor<Place<K>[]>;
};

// ============================================================================
// MARK: createSortable
// ============================================================================

/**
 * A pure computation primitive for sortable lists.
 *
 * Given an ordered list of item keys and measurement functions for their
 * bounding rects, computes where a dragged item would be inserted based
 * on pointer position.
 *
 * This is layout-aware but DOM-agnostic — you provide the measurement
 * functions, it does the math.
 *
 * ## How insertion points work
 *
 * For a vertical list with items A, B, C there are 4 insertion positions:
 *
 * ```
 *   ──── before A ────
 *   ┌──────────────┐
 *   │      A       │  ← center of A is the boundary
 *   └──────────────┘
 *   ──── before B ────
 *   ┌──────────────┐
 *   │      B       │  ← center of B is the boundary
 *   └──────────────┘
 *   ──── before C ────
 *   ┌──────────────┐
 *   │      C       │  ← center of C is the boundary
 *   └──────────────┘
 *   ──── append ──────
 * ```
 *
 * The boundary between adjacent positions is at the vertical center of
 * each item. Pointer above center → insert before that item. Below all
 * centers → append at end.
 *
 * @example
 * ```tsx
 * const sortable = createSortable({
 *   containerKey: 'list',
 *   items: () => ['a', 'b', 'c'],
 *   getRect: (key) => refs.get(key)?.getBoundingClientRect(),
 *   getContainerRect: () => containerRef?.getBoundingClientRect(),
 * });
 *
 * // During drag:
 * const place = sortable.getInsertionPoint(pointerPos);
 * // → { parent: 'list', before: 'b' }
 * ```
 */
export function createSortable<K>(options: SortableOptions<K>): Sortable<K> {
  // ── Derived: all valid insertion points ────────────────────────────────
  const insertionPoints = createMemo<Place<K>[]>(() => {
    const keys = options.items();
    const points: Place<K>[] = keys.map((key) => ({
      parent: options.containerKey,
      before: key
    }));
    // Append position (after last item)
    points.push({ parent: options.containerKey, before: null });
    return points;
  });

  // ── Imperative: find best insertion point ─────────────────────────────
  function getInsertionPoint(position: Vec2): Place<K> | undefined {
    const containerRect = options.getContainerRect();
    if (!containerRect) return undefined;

    // Reject pointer outside container bounds
    if (
      position.x < containerRect.x ||
      position.x > containerRect.x + containerRect.width ||
      position.y < containerRect.y ||
      position.y > containerRect.y + containerRect.height
    ) {
      return undefined;
    }

    const dKeys = options.draggedKeys?.();
    const allKeys = options.items();
    const keys = dKeys && dKeys.length > 0 ? allKeys.filter((k) => !dKeys.includes(k)) : allKeys;
    const containerKey = options.containerKey;

    // Empty list (or all items are being dragged) → only valid position is append
    if (keys.length === 0) {
      return { parent: containerKey, before: null };
    }

    // Vertical list: find the first item whose vertical center is below the pointer.
    // The pointer is "above" that item → insert before it.
    for (let i = 0; i < keys.length; i++) {
      const rect = options.getRect(keys[i]);
      if (!rect) continue;

      const centerY = rect.y + rect.height / 2;
      if (position.y < centerY) {
        return { parent: containerKey, before: keys[i] };
      }
    }

    // Below all items → append at end
    return { parent: containerKey, before: null };
  }

  // ── Indicator offset for a given place ─────────────────────────────────
  function getIndicatorOffset(place: Place<K> | undefined): number | undefined {
    if (!place) return undefined;

    const containerRect = options.getContainerRect();
    if (!containerRect) return undefined;

    if (place.before !== null) {
      const rect = options.getRect(place.before);
      if (!rect) return undefined;
      return rect.y - containerRect.y;
    }

    // Append: bottom edge of last non-dragged item
    const dKeys = options.draggedKeys?.();
    const allKeys = options.items();
    const keys = dKeys && dKeys.length > 0 ? allKeys.filter((k) => !dKeys.includes(k)) : allKeys;
    if (keys.length === 0) return 0;

    const lastRect = options.getRect(keys[keys.length - 1]);
    if (!lastRect) return undefined;
    return lastRect.y + lastRect.height - containerRect.y;
  }

  return {
    getInsertionPoint,
    getIndicatorOffset,
    insertionPoints
  };
}
