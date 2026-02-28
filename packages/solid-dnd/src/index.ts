// ============================================================================
// solid-dnd — Composable drag-and-drop primitives for SolidJS
// ============================================================================

// Core types
export { createItemId } from './core/types';
export type { GridConfig, ItemId, LayoutMode, NestableContainer } from './core/types';

// Core geometry & place modules
// Use as namespace: Rect.of(), Place.label(), Tree.move(), Grid.resolveGrid()
// Use as type:      Rect.Rect, Place.Place<K>, Vec2.Vec2, Tree.Tree, Grid.GridCell
export * as Grid from './core/gridLayout';
export * as Place from './core/place';
export * as Rect from './core/rect';
export * as Tree from './core/tree';
export * as Vec2 from './core/vec2';

// Core utilities
export { GAP_KEY, computeDisplayKeys, computeTreeDisplayKeys } from './core/displayList';
export type { GapKey } from './core/displayList';
export { getListInsertionPoint } from './core/listInsertion';
export { reorderItems } from './core/reorder';
export { applyGridRange, applyRange, applySet, applyToggle, getSelectionMode } from './core/selectionModes';
export type { SelectionMode } from './core/selectionModes';

// Primitives
export { createDragController } from './composites/createDragController';
export type { DragController, DragControllerOptions } from './composites/createDragController';
export { getGridIndicatorPosition, getGridInsertionPoint } from './core/gridInsertion';
export { accepts, wouldCycle } from './core/tagConstraints';
export { createDragOverlay } from './primitives/createDragOverlay';
export type { DragOverlay, DragOverlayOptions } from './primitives/createDragOverlay';
export { createDragSensor } from './primitives/createDragSensor';
export type {
  DragEndEvent,
  DragMoveEvent,
  DragSensor,
  DragSensorOptions,
  DragStartEvent
} from './primitives/createDragSensor';
export { createDropzone, createTreeDropzone } from './primitives/createDropzone';
export type { Dropzone, DropzoneOptions, TreeDropzone, TreeDropzoneOptions } from './primitives/createDropzone';
export { createFlip } from './primitives/createFlip';
export type { Flip, FlipAnimateEntry, FlipOptions } from './primitives/createFlip';
export { createNestable } from './primitives/createNestable';
export type { Nestable, NestableOptions } from './primitives/createNestable';
export { createSelection } from './primitives/createSelection';
export type { Selection, SelectionOptions } from './primitives/createSelection';
export { createSortable } from './primitives/createSortable';
export type { Sortable, SortableOptions } from './primitives/createSortable';
export { calculateDeltas, measureElements } from './primitives/flipUtils';
export type { ElementSnapshot, FlipDelta } from './primitives/flipUtils';
// export { createAutoScroll } from './primitives/createAutoScroll';

// Utilities types re-export
export type { MaybeAccessor } from '@solid-primitives/utils';
