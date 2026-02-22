// ============================================================================
// MARK: Item Identity
// ============================================================================

/** Branded string type for type-safe item identification. */
export type ItemId = string & { readonly __brand: 'ItemId' };

export function createItemId(value: string): ItemId {
  return value as ItemId;
}

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
