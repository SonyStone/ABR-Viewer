// ============================================================================
// solid-dnd — Composable drag-and-drop primitives for SolidJS
// ============================================================================

// Core types
export { createItemId } from './core/types';
export type { GridConfig, ItemId, LayoutMode } from './core/types';

// Core geometry & place modules
// Use as namespace: Rect.of(), Place.label()
// Use as type:      Rect.Rect, Place.Place<K>, Vec2.Vec2
export * as Place from './core/place';
export * as Rect from './core/rect';
export * as Vec2 from './core/vec2';

// Core utilities
export { reorderItems } from './core/reorder';
export { applyRange, applySet, applyToggle, getSelectionMode } from './core/selectionModes';
export type { SelectionMode } from './core/selectionModes';

// Primitives
export { accepts, wouldCycle } from './core/tagConstraints';
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
export { createNestable } from './primitives/createNestable';
export type { Nestable, NestableContainer, NestableOptions } from './primitives/createNestable';
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
