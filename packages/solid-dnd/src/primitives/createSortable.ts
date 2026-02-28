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

export type SortableOptions<K> = Parameters<typeof createSortable<K>>[0];
export type Sortable<K> = ReturnType<typeof createSortable<K>>;

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
export function createSortable<K>(options: {
  /** The key of the container these items belong to. */
  containerKey: K;
  /** Accessor returning the ordered list of item keys. */
  items: Accessor<K[]>;
  /** Returns the bounding rect for an item by its key. */
  getRect: (key: K) => Rect | undefined;
  /** Returns the bounding rect for the container element. */
  getContainerRect: () => Rect | undefined;
  /**
   * Returns the bounding rect for the container used only for hit-testing
   * (pointer-inside check). When provided, `getContainerRect` is still
   * used for grid resolution, but this rect decides if the pointer is
   * "inside" the sortable area.
   *
   * Useful when the dropzone container has different bounds than the
   * measurement container (e.g., a wrapper that should accept drops in
   * a larger area).
   */
  getHitRect?: () => Rect | undefined;
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
}) {
  const isGrid = () => options.layout === 'grid';

  // Unwrap gridConfig: supports both static GridConfig and Accessor<GridConfig>
  const getGridConfig = (): GridConfig | undefined => {
    const cfg = options.gridConfig;
    return typeof cfg === 'function' ? cfg() : cfg;
  };

  // ── Resolved grid (memoized, undefined for list layout) ────────────────
  // Uses options.items() (all items) rather than activeItems() (dragged
  // items excluded). The grid cell dimensions don't change based on which
  // items are being dragged, and using options.items() avoids an eager
  // dependency on draggedKeys() during construction — which would require
  // the consumer to declare their drag controller before createSortable.
  const resolvedGrid = createMemo<ResolvedGrid | undefined>(() => {
    const gc = getGridConfig();
    if (!isGrid() || !gc) return undefined;
    const containerRect = options.getContainerRect();
    const keys = options.items();
    // Measure first item height for 'auto' rowHeight
    const firstRect = keys.length > 0 ? options.getRect(keys[0]) : undefined;
    return resolveGrid(gc, keys.length, containerRect?.width, firstRect?.height);
  });

  // ── Rect snapshots for stable insertion during drag ─────────────────────
  let rectSnapshot: Map<K, Rect> | null = null;

  /**
   * Snapshot rects for stable insertion point calculation.
   *
   * When `excludeKeys` is provided, the snapshot computes "compact" positions:
   * items below the excluded keys are shifted up as if the excluded items were
   * removed from the layout. This prevents the dragged item's original space
   * from offsetting insertion zones.
   *
   * @param excludeKeys  Keys to exclude from the snapshot (typically the dragged items).
   */
  function snapshotRects(excludeKeys?: K[]): void {
    const allKeys = options.items();
    const snap = new Map<K, Rect>();

    if (!excludeKeys || excludeKeys.length === 0) {
      // No exclusions — simple snapshot of active items
      for (const key of allKeys) {
        const rect = options.getRect(key);
        if (rect) snap.set(key, rect);
      }
      rectSnapshot = snap;
      return;
    }

    const excludeSet = new Set(excludeKeys);

    // Measure all items and sort by vertical position
    type Measured = { key: K; rect: Rect };
    const measured: Measured[] = [];
    for (const key of allKeys) {
      const rect = options.getRect(key);
      if (rect) measured.push({ key, rect });
    }
    measured.sort((a, b) => a.rect.y - b.rect.y);

    // Detect spacing between adjacent items (CSS flex gap / margin)
    let spacing = 0;
    for (let i = 1; i < measured.length; i++) {
      const gap = measured[i].rect.y - (measured[i - 1].rect.y + measured[i - 1].rect.height);
      if (gap > 0) {
        spacing = gap;
        break;
      }
    }

    // Build compact snapshot: excluded items' vertical space is removed,
    // and items below them shift up accordingly.
    let removedHeight = 0;
    for (const m of measured) {
      if (excludeSet.has(m.key)) {
        removedHeight += m.rect.height + spacing;
        continue;
      }
      snap.set(m.key, {
        x: m.rect.x,
        y: m.rect.y - removedHeight,
        width: m.rect.width,
        height: m.rect.height
      });
    }

    rectSnapshot = snap;
  }

  function clearSnapshot(): void {
    rectSnapshot = null;
  }

  /** Get a rect for insertion calculation — prefer snapshot over live. */
  function getInsertionRect(key: K): Rect | undefined {
    return rectSnapshot?.get(key) ?? options.getRect(key);
  }

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

    // Use a separate hit-test rect if provided (e.g., a larger dropzone area)
    const hitRect = options.getHitRect?.() ?? containerRect;

    // Reject pointer outside container bounds
    if (
      position.x < hitRect.x ||
      position.x > hitRect.x + hitRect.width ||
      position.y < hitRect.y ||
      position.y > hitRect.y + hitRect.height
    ) {
      return undefined;
    }

    // Use snapshot rects when available so gap displacement doesn't
    // shift item center-lines and make insertion zones unresponsive.
    return getListInsertionPoint(keys, containerKey, position, getInsertionRect);
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
    getInsertionPoint,
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
    getIndicatorOffset,
    /**
     * Grid-specific indicator positioning. Returns `{ x, y, height }` relative
     * to the container, for a vertical insertion bar.
     *
     * Returns `undefined` for non-grid layouts or invalid places.
     */
    getGridIndicator,
    /**
     * All valid insertion points for the current item list.
     * For N items, returns N+1 places: before each item + append at end.
     * Useful for rendering drop indicators at every possible position.
     */
    insertionPoints,
    /**
     * The resolved grid dimensions, or `undefined` if layout is not 'grid'.
     * Useful for rendering and computing cell positions.
     */
    resolvedGrid,
    /**
     * Snapshot the current bounding rects of all items for stable insertion
     * calculation during drag.
     *
     * Once captured, `getInsertionPoint` uses these fixed rects instead of
     * live DOM measurements. This prevents the gap placeholder from
     * displacing items and shifting their center-lines, which would make
     * insertion zones feel unresponsive during drag.
     *
     * When `excludeKeys` is provided (typically the dragged item keys), the
     * snapshot computes "compact" positions: items below the excluded keys
     * are shifted up as if the excluded items were removed from the layout.
     * This ensures the insertion zones match the visual positions of the
     * remaining items.
     *
     * Call this at drag start (before the gap is inserted into the DOM).
     *
     * @param excludeKeys  Keys to exclude (e.g., the dragged item keys).
     */
    snapshotRects,
    /**
     * Clear the rect snapshot so `getInsertionPoint` reverts to live
     * DOM measurements.
     *
     * Call this at drag end / cancel.
     */
    clearSnapshot
  };
}
