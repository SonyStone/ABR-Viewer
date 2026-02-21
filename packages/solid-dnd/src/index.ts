// ============================================================================
// solid-dnd — Composable drag-and-drop primitives for SolidJS
// ============================================================================

// Core types
export { Rect as RectUtils, Vec2 as Vec2Utils, createItemId } from './core/types';
export type { GridConfig, ItemId, LayoutMode, Place, Rect, Vec2 } from './core/types';

// Primitives
export { createDragSensor } from './primitives/createDragSensor';
export type {
  DragEndEvent,
  DragMoveEvent,
  DragSensor,
  DragSensorOptions,
  DragStartEvent
} from './primitives/createDragSensor';
// export { createSortable } from './primitives/createSortable';
// export { createSelection } from './primitives/createSelection';
// export { createFlip } from './primitives/createFlip';
// export { createAutoScroll } from './primitives/createAutoScroll';

// Components (will be added as implemented)
// export { SortableList } from './components/SortableList';
// export { DragOverlay } from './components/DragOverlay';
