// ============================================================================
// Grid Insertion — Compute drop position in a grid layout
// ============================================================================

import { type ResolvedGrid, cellToIndex, indexToCell, pointToCell } from './gridLayout';
import type { Place } from './place';
import type { Rect } from './rect';
import type { Vec2 } from './vec2';

// ============================================================================
// MARK: getGridInsertionPoint
// ============================================================================

/**
 * Given a pointer position, find the best insertion point in a grid layout.
 *
 * ## Algorithm
 *
 * 1. Map the pointer to the nearest grid cell via `pointToCell`.
 * 2. Within that cell, check whether the pointer is in the left or right half.
 *    - **Left half** → insert **before** this cell's item.
 *    - **Right half** → insert **after** this cell's item (= before next item).
 * 3. Clamp the resulting index to `[0, itemCount]`.
 * 4. Return `{ parent, before: items[insertIdx] }` or `{ parent, before: null }` for append.
 *
 * This gives a natural left-to-right, top-to-bottom insertion flow.
 *
 * @param position       Current pointer position.
 * @param containerKey   Key of the container.
 * @param items          Ordered item keys (excluding dragged items).
 * @param grid           Resolved grid dimensions.
 * @param containerRect  Bounding rect of the grid container.
 * @param getRectForItem Optional: measure actual item rects for more precise half-detection.
 *                       Falls back to computed cell rects.
 */
export function getGridInsertionPoint<K>(
  position: Vec2,
  containerKey: K,
  items: K[],
  grid: ResolvedGrid,
  containerRect: Rect,
  getRectForItem?: (key: K) => Rect | undefined
): Place<K> | undefined {
  // Reject pointer outside container
  if (
    position.x < containerRect.x ||
    position.x > containerRect.x + containerRect.width ||
    position.y < containerRect.y ||
    position.y > containerRect.y + containerRect.height
  ) {
    return undefined;
  }

  // Empty grid → append
  if (items.length === 0) {
    return { parent: containerKey, before: null };
  }

  const origin = { x: containerRect.x, y: containerRect.y };
  const cell = pointToCell(position, grid, origin);
  const flatIndex = cellToIndex(cell, grid.columns);

  // If the pointer is beyond the last item, append
  if (flatIndex >= items.length) {
    return { parent: containerKey, before: null };
  }

  // Determine left/right half of the target cell
  const itemKey = items[flatIndex];
  let cellCenterX: number;

  if (getRectForItem) {
    const rect = getRectForItem(itemKey);
    if (rect) {
      cellCenterX = rect.x + rect.width / 2;
    } else {
      // Fallback: compute from grid
      const cellStep = grid.columnWidth + grid.colGap;
      cellCenterX = origin.x + cell.col * cellStep + grid.columnWidth / 2;
    }
  } else {
    const cellStep = grid.columnWidth + grid.colGap;
    cellCenterX = origin.x + cell.col * cellStep + grid.columnWidth / 2;
  }

  if (position.x < cellCenterX) {
    // Left half → insert before this item
    return { parent: containerKey, before: itemKey };
  } else {
    // Right half → insert after this item (= before next, or append)
    const nextIndex = flatIndex + 1;
    if (nextIndex >= items.length) {
      return { parent: containerKey, before: null };
    }
    return { parent: containerKey, before: items[nextIndex] };
  }
}

// ============================================================================
// MARK: getGridIndicatorPosition
// ============================================================================

/**
 * Compute the pixel position for a drop indicator in a grid layout.
 *
 * Returns `{ x, y }` relative to the container, representing the top-left
 * of a vertical insertion line between cells.
 *
 * @param place          The insertion place.
 * @param items          Ordered item keys.
 * @param grid           Resolved grid dimensions.
 * @param containerRect  Container bounding rect.
 * @param getRectForItem Measure item rects for precise positioning.
 */
export function getGridIndicatorPosition<K>(
  place: Place<K> | undefined,
  items: K[],
  grid: ResolvedGrid,
  containerRect: Rect,
  getRectForItem?: (key: K) => Rect | undefined
): { x: number; y: number; height: number } | undefined {
  if (!place) return undefined;
  if (items.length === 0) {
    return { x: 0, y: 0, height: grid.rowHeight };
  }

  const origin = { x: containerRect.x, y: containerRect.y };

  if (place.before !== null) {
    // Insert before this item → indicator at item's left edge
    const idx = items.indexOf(place.before as K);
    if (idx === -1) return undefined;

    if (getRectForItem) {
      const rect = getRectForItem(place.before as K);
      if (rect) {
        return {
          x: rect.x - origin.x,
          y: rect.y - origin.y,
          height: rect.height
        };
      }
    }

    // Fallback: compute from grid
    const cell = indexToCell(idx, grid.columns);
    return {
      x: cell.col * (grid.columnWidth + grid.colGap),
      y: cell.row * (grid.rowHeight + grid.rowGap),
      height: grid.rowHeight
    };
  }

  // Append: indicator at the right edge of the last item
  const lastIdx = items.length - 1;

  if (getRectForItem) {
    const rect = getRectForItem(items[lastIdx]);
    if (rect) {
      return {
        x: rect.x + rect.width - origin.x,
        y: rect.y - origin.y,
        height: rect.height
      };
    }
  }

  const lastCell = indexToCell(lastIdx, grid.columns);
  return {
    x: lastCell.col * (grid.columnWidth + grid.colGap) + grid.columnWidth,
    y: lastCell.row * (grid.rowHeight + grid.rowGap),
    height: grid.rowHeight
  };
}
