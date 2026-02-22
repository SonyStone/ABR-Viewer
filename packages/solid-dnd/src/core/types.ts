// ============================================================================
// MARK: Item Identity
// ============================================================================

/** Branded string type for type-safe item identification. */
export type ItemId = string & { readonly __brand: 'ItemId' };

export function createItemId(value: string): ItemId {
  return value as ItemId;
}

// ============================================================================
// MARK: Place — Universal Insertion Coordinate
// ============================================================================

/**
 * Describes a position in a container where items can be inserted.
 *
 * @example
 *   { parent: 'folder-1', before: 'item-3' }  // Insert before item-3 in folder-1
 *   { parent: 'folder-1', before: null }       // Append at end of folder-1
 */
export type Place<K> = {
  /** The key of the container to insert into. */
  parent: K;
  /** The key of the item to insert before, or `null` to append at the end. */
  before: K | null;
};

// ============================================================================
// MARK: Layout Modes
// ============================================================================

export type LayoutMode = 'list' | 'wrap' | 'grid';

export type GridConfig = {
  /** Number of columns, or 'auto' to compute from container width + columnWidth. */
  columns: number | 'auto';
  /** Fixed column width in pixels (required when columns is 'auto'). */
  columnWidth?: number;
  /** Row height in pixels, or 'auto' for content-sized rows. */
  rowHeight?: number | 'auto';
  /** Gap between items in pixels, or [rowGap, columnGap]. */
  gap: number | [number, number];
};

// ============================================================================
// MARK: Geometry
// ============================================================================

export type Vec2 = Readonly<{ x: number; y: number }>;

export const Vec2 = {
  Zero: { x: 0, y: 0 } as Vec2,
  of: (x: number, y: number): Vec2 => ({ x, y })
} as const;

export type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

export const Rect = {
  Zero: { x: 0, y: 0, width: 0, height: 0 } as Rect,
  of: (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height }),
  /** Create a Rect from an element's bounding client rect. */
  fromElement: (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
} as const;

// ============================================================================
// MARK: Place Utilities
// ============================================================================

export const Place = {
  /**
   * Human-readable label for a Place, useful for debugging and display.
   *
   * @example
   *   Place.label({ parent: 'list', before: 'b' }) // 'before "b"'
   *   Place.label({ parent: 'list', before: null }) // 'append'
   *   Place.label(undefined)                        // 'none'
   */
  label: <K>(place: Place<K> | undefined): string => {
    if (!place) return 'none';
    return place.before !== null ? `before "${place.before}"` : 'append';
  }
} as const;
