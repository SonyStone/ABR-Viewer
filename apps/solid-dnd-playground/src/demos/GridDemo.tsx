import { createBodyCursor } from '@solid-primitives/cursor';
import type { GridConfig } from 'solid-dnd';
import {
  createDragController,
  createSelection,
  createSortable,
  Place,
  Rect,
  reorderItems,
  type DragController
} from 'solid-dnd';
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { GridControls } from '../components/GridControls';
import { GridDropIndicator } from '../components/GridDropIndicator';
import { GridItem } from '../components/GridItem';
import { OrderDisplay } from '../components/OrderDisplay';
import { SelectionInfo } from '../components/SelectionInfo';
import { StateCard } from '../components/StateCard';
import { createGridItems } from '../data';

// ============================================================================
// MARK: Grid Demo
// ============================================================================

/**
 * Interactive grid demo combining createDragController + createSortable (grid mode)
 * + createSelection (with grid range selection).
 */
export default function GridDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── Item state ──────────────────────────────────────────────────────────
  const [items, setItems] = createSignal(createGridItems());
  const itemKeys = createMemo(() => items().map((i) => i.id));

  // ── Grid config ─────────────────────────────────────────────────────────
  const [columns, setColumns] = createSignal(4);
  const gridConfig = createMemo<GridConfig>(() => ({
    columns: columns(),
    gap: 8,
    rowHeight: 'auto'
  }));

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  let containerRef: HTMLDivElement | undefined;

  // ── Animation controls ──────────────────────────────────────────────────
  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);

  // ── Selection ───────────────────────────────────────────────────────────
  const selection = createSelection<string>({
    items: itemKeys,
    gridColumns: () => columns(),
    onSelectionChange: (keys) => {
      if (keys.length > 0) {
        logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
      }
    }
  });

  // ── Sortable primitive (grid mode) ──────────────────────────────────────
  const sortable = createSortable<string>({
    containerKey: 'grid',
    items: itemKeys,
    layout: 'grid',
    gridConfig: gridConfig,
    draggedKeys: () => drag.draggedIds(),
    getRect: (key) => Rect.fromElement(itemRefs.get(key)),
    getContainerRect: () => Rect.fromElement(containerRef)
  });

  // ── Drag controller (sensor + overlay + FLIP) ──────────────────────────
  const drag: DragController<string> = createDragController<string>({
    elements: itemRefs as Map<string, HTMLElement>,
    getInsertionPoint: (pos) => sortable.getInsertionPoint(pos),

    onBeforeDragStart: (id) => {
      return selection.isSelected(id) ? selection.selected() : [id];
    },

    onClick: (ev, id) => selection.handleClick(id, ev),

    onDrop: (keys, place) => {
      setItems((prev) => reorderItems(prev, keys, place, (i) => i.id));
    },

    onDragStart: (keys, pos) => {
      logger.addLog(`▶ DRAG  [${keys.join(', ')}] at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
    },

    onDropLog: (keys, place) => {
      logger.addLog(`■ DROP  [${keys.join(', ')}] → ${Place.label(place)}`);
    },

    onCancelLog: () => logger.addLog('✕ CANCEL'),

    duration: () => animDuration(),
    animEnabled: () => animEnabled()
  });

  // ── Reactive cursor ─────────────────────────────────────────────────────
  createBodyCursor(() => (drag.sensor.isDragging() ? 'grabbing' : null));

  // ── Grid indicator position ─────────────────────────────────────────────
  function indicatorPos() {
    if (!drag.sensor.isDragging()) return undefined;
    return sortable.getGridIndicator(drag.dropPlace());
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable Grid</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Drag items to reorder in a grid. Click to select, Ctrl+click to toggle, Shift+click for rectangular range.
          Combines <code class="rounded bg-white/10 px-1">createDragController</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> (grid mode) +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code> (grid range).
        </p>
      </div>

      {/* ── Grid controls ──────────────────────────────────────────── */}
      <GridControls
        columns={columns()}
        setColumns={setColumns}
        animEnabled={animEnabled()}
        setAnimEnabled={setAnimEnabled}
        animDuration={animDuration()}
        setAnimDuration={setAnimDuration}
        isAnimating={drag.flip.isAnimating()}
      />

      {/* ── Selection info ─────────────────────────────────────────── */}
      <SelectionInfo
        selected={selection.selected()}
        items={items()}
        onClear={() => selection.clear()}
        hint="Click items to select · Ctrl+click to multi-select · Shift+click for rectangular range"
      />

      {/* ── Grid container ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Sortable grid"
        class="relative rounded-xl border border-white/10 bg-white/2 p-3"
        style={{ display: 'grid', 'grid-template-columns': `repeat(${columns()}, 1fr)`, gap: '8px' }}
      >
        <For each={items()}>
          {(item) => (
            <GridItem
              item={item}
              isDragged={drag.draggedIds().includes(item.id) && drag.sensor.isDragging()}
              isSelected={selection.isSelected(item.id)}
              onPointerDown={(ev) => drag.onPointerDown(item.id, ev)}
              ref={(el) => itemRefs.set(item.id, el)}
            />
          )}
        </For>

        {/* Drop indicator (vertical bar) */}
        <Show when={indicatorPos()}>
          {(pos) => <GridDropIndicator x={pos().x} y={pos().y} height={pos().height} />}
        </Show>
      </div>

      {/* ── Order display ─────────────────────────────────────────── */}
      <OrderDisplay items={items()} columns={columns()} />

      {/* ── State readout ─────────────────────────────────────────── */}
      <div class="grid grid-cols-4 gap-3">
        <StateCard
          label="isDragging"
          value={drag.sensor.isDragging() ? 'true' : 'false'}
          active={drag.sensor.isDragging()}
        />
        <StateCard
          label="dragging"
          value={drag.draggedIds().length > 0 ? drag.draggedIds().join(', ') : 'none'}
          active={drag.draggedIds().length > 0}
        />
        <StateCard label="dropPlace" value={Place.label(drag.dropPlace())} active={drag.dropPlace() !== undefined} />
        <StateCard
          label="selected"
          value={selection.selected().length > 0 ? `${selection.selected().length} items` : 'none'}
          active={selection.selected().length > 0}
        />
      </div>

      {/* ── Event log ─────────────────────────────────────────────── */}
      <EventLog logger={logger} />
    </div>
  );
}
