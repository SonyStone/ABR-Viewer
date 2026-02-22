// ============================================================================
// solid-dnd — Composable drag-and-drop primitives for SolidJS
// ============================================================================

// Core types
export { Rect as RectUtils, Vec2 as Vec2Utils, createItemId } from './core/types';
export type { GridConfig, ItemId, LayoutMode, Place, Rect, Vec2 } from './core/types';

// Primitives
export { applyRange, applySet, applyToggle, getSelectionMode } from './core/selectionModes';
export type { SelectionMode } from './core/selectionModes';
export { createDragSensor } from './primitives/createDragSensor';
export type {
  DragEndEvent,
  DragMoveEvent,
  DragSensor,
  DragSensorOptions,
  DragStartEvent
} from './primitives/createDragSensor';
export { createFlip } from './primitives/createFlip';
export type { Flip, FlipOptions } from './primitives/createFlip';
export { createSelection } from './primitives/createSelection';
export type { Selection, SelectionOptions } from './primitives/createSelection';
export { createSortable } from './primitives/createSortable';
export type { Sortable, SortableOptions } from './primitives/createSortable';
export { calculateDeltas, measureElements } from './primitives/flipUtils';
export type { ElementSnapshot, FlipDelta } from './primitives/flipUtils';
// export { createAutoScroll } from './primitives/createAutoScroll';

// Components (will be added as implemented)
// export { SortableList } from './components/SortableList';
// export { DragOverlay } from './components/DragOverlay';
