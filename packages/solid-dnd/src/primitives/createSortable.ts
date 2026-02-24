import { createMemo, type Accessor } from 'solid-js';
import { getGridIndicatorPosition } from '../core/gridInsertion';
import { cellToIndex, pointToCell, resolveGrid, type ResolvedGrid } from '../core/gridLayout';
import { getListInsertionPoint } from '../core/listInsertion';
import type { Place } from '../core/place';
import type { Rect } from '../core/rect';
import type { GridConfig } from '../core/types';
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
   * - `'list'` — vertical list (default)
   * - `'grid'` — CSS grid / flex-wrap layout (requires `gridConfig`)
   * @default 'list'
   */
  layout?: 'list' | 'grid';
  /**
   * Grid configuration. Required when `layout` is `'grid'`.
   * Defines columns, row height, and gap.
   *
   * Accepts either a static `GridConfig` object or an `Accessor<GridConfig>`
   * for reactive updates (e.g., when the user changes column count).
   */
  gridConfig?: GridConfig | Accessor<GridConfig>;
  /**
   * Spacing between items in pixels. Used as a hint for indicator placement
   * in list mode. Does not affect grid mode (use gridConfig.gap instead).
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
   *
   * For a grid, uses 2D cell detection with left/right half logic.
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
   *
   * For grid layouts, use `getGridIndicator` instead.
   */
  getIndicatorOffset: (place: Place<K> | undefined) => number | undefined;
  /**
   * Grid-specific indicator positioning. Returns `{ x, y, height }` relative
   * to the container, for a vertical insertion bar.
   *
   * Returns `undefined` for non-grid layouts or invalid places.
   */
  getGridIndicator: (place: Place<K> | undefined) => { x: number; y: number; height: number } | undefined;
  /**
   * All valid insertion points for the current item list.
   * For N items, returns N+1 places: before each item + append at end.
   * Useful for rendering drop indicators at every possible position.
   */
  insertionPoints: Accessor<Place<K>[]>;
  /**
   * The resolved grid dimensions, or `undefined` if layout is not 'grid'.
   * Useful for rendering and computing cell positions.
   */
  resolvedGrid: Accessor<ResolvedGrid | undefined>;
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
  const isGrid = () => options.layout === 'grid';

  // Unwrap gridConfig: supports both static GridConfig and Accessor<GridConfig>
  const getGridConfig = (): GridConfig | undefined => {
    const cfg = options.gridConfig;
    return typeof cfg === 'function' ? cfg() : cfg;
  };

  // ── Resolved grid (memoized, undefined for list layout) ────────────────
  const resolvedGrid = createMemo<ResolvedGrid | undefined>(() => {
    const gc = getGridConfig();
    if (!isGrid() || !gc) return undefined;
    const containerRect = options.getContainerRect();
    const keys = activeItems();
    // Measure first item height for 'auto' rowHeight
    const firstRect = keys.length > 0 ? options.getRect(keys[0]) : undefined;
    return resolveGrid(gc, keys.length, containerRect?.width, firstRect?.height);
  });

  // ── Active items (excluding dragged) ───────────────────────────────────
  function activeItems(): K[] {
    const dKeys = options.draggedKeys?.();
    const allKeys = options.items();
    if (!dKeys || dKeys.length === 0) return allKeys;
    const dragSet = new Set(dKeys);
    return allKeys.filter((k) => !dragSet.has(k));
  }

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

    const containerKey = options.containerKey;

    // ── Grid layout ──────────────────────────────────────────────────────
    // Strategy: use the FULL item count for grid geometry (stable cell
    // dimensions), but use visibleKeys (dragged items removed) for item
    // lookup. The display list is visibleKeys + 1 gap = same total cell
    // count as the full grid, so cell index maps directly to visibleKeys.
    //
    // We do NOT use left/right-half detection here. In a grid, the gap
    // always appears at the cell the pointer is over. Left/right halving
    // would cause the gap to jump to the next row when hovering the right
    // side of the last column, which feels wrong.
    if (isGrid()) {
      const gc = getGridConfig();
      if (!gc) return undefined;
      const allKeys = options.items();
      const dKeys = options.draggedKeys?.() ?? [];
      const visibleKeys =
        dKeys.length > 0
          ? (() => {
              const s = new Set(dKeys);
              return allKeys.filter((k) => !s.has(k));
            })()
          : allKeys;

      // Measure row height from the first visible (non-dragged) item
      let measuredHeight: number | undefined;
      for (const k of visibleKeys) {
        measuredHeight = options.getRect(k)?.height;
        if (measuredHeight !== undefined) break;
      }

      // Resolve grid using FULL item count for stable cell dimensions
      const fullGrid = resolveGrid(gc, allKeys.length, containerRect.width, measuredHeight);

      // Reject pointer outside container
      if (
        position.x < containerRect.x ||
        position.x > containerRect.x + containerRect.width ||
        position.y < containerRect.y ||
        position.y > containerRect.y + containerRect.height
      ) {
        return undefined;
      }

      // Empty visible list → append
      if (visibleKeys.length === 0) {
        return { parent: containerKey, before: null };
      }

      // Map pointer → cell → flat index (no left/right half)
      const origin = { x: containerRect.x, y: containerRect.y };
      const cell = pointToCell(position, fullGrid, origin);
      const cellIndex = cellToIndex(cell, fullGrid.columns);

      if (cellIndex >= visibleKeys.length) {
        return { parent: containerKey, before: null };
      }
      return { parent: containerKey, before: visibleKeys[cellIndex] };
    }

    // ── List layout ──────────────────────────────────────────────────────
    const keys = activeItems();

    // Reject pointer outside container bounds
    if (
      position.x < containerRect.x ||
      position.x > containerRect.x + containerRect.width ||
      position.y < containerRect.y ||
      position.y > containerRect.y + containerRect.height
    ) {
      return undefined;
    }

    // Delegate to shared vertical center-line algorithm
    return getListInsertionPoint(keys, containerKey, position, options.getRect);
  }

  // ── Indicator offset for a given place (list layout) ───────────────────
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
    const keys = activeItems();
    if (keys.length === 0) return 0;

    const lastRect = options.getRect(keys[keys.length - 1]);
    if (!lastRect) return undefined;
    return lastRect.y + lastRect.height - containerRect.y;
  }

  // ── Grid indicator position ────────────────────────────────────────────
  function getGridIndicator(place: Place<K> | undefined): { x: number; y: number; height: number } | undefined {
    const grid = resolvedGrid();
    if (!grid) return undefined;

    const containerRect = options.getContainerRect();
    if (!containerRect) return undefined;

    const keys = activeItems();
    return getGridIndicatorPosition(place, keys, grid, containerRect, options.getRect);
  }

  return {
    getInsertionPoint,
    getIndicatorOffset,
    getGridIndicator,
    insertionPoints,
    resolvedGrid
  };
}
