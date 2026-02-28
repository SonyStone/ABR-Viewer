import { createBodyCursor } from '@solid-primitives/cursor';
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
import { AnimationControls } from '../components/AnimationControls';
import { DropIndicator } from '../components/DropIndicator';
import EventLog, { createEventLogger } from '../components/EventLog';
import { ListItem } from '../components/ListItem';
import { OrderDisplay } from '../components/OrderDisplay';
import { SelectionInfo } from '../components/SelectionInfo';
import { StateCard } from '../components/StateCard';
import { createDemoItems } from '../data';

// ============================================================================
// MARK: List Demo
// ============================================================================

export default function ListDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── Item state ──────────────────────────────────────────────────────────
  const [items, setItems] = createSignal(createDemoItems());
  const itemKeys = createMemo(() => items().map((i) => i.id));

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  let containerRef: HTMLDivElement | undefined;

  // ── Animation controls ──────────────────────────────────────────────────
  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);

  // ── Selection ───────────────────────────────────────────────────────────
  const selection = createSelection<string>({
    items: itemKeys,
    onSelectionChange: (keys) => {
      if (keys.length > 0) {
        logger.addLog(LOGS.SELECT(keys));
      }
    }
  });

  // ── Sortable primitive ──────────────────────────────────────────────────
  const sortable = createSortable<string>({
    containerKey: 'list',
    items: itemKeys,
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
      logger.addLog(LOGS.DRAG(keys, keys[0] ?? '', { position: pos }));
    },
    onDropLog: (keys, place) => {
      logger.addLog(LOGS.DROP(keys, place));
    },
    onCancelLog: () => logger.addLog(LOGS.CANCEL()),
    duration: () => animDuration(),
    animEnabled: () => animEnabled()
  });

  // ── Reactive cursor: grabbing while dragging ────────────────────────────
  createBodyCursor(() => (drag.sensor.isDragging() ? 'grabbing' : null));

  // ── Drop indicator Y position (relative to container) ─────────────────
  function indicatorY(): number | undefined {
    if (!drag.sensor.isDragging()) return undefined;
    return sortable.getIndicatorOffset(drag.dropPlace());
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable List</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Drag items to reorder. Click to select, Ctrl+click to toggle, Shift+click for range. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDragController</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

      {/* ── Animation controls ─────────────────────────────────────── */}
      <AnimationControls
        enabled={animEnabled()}
        setEnabled={setAnimEnabled}
        duration={animDuration()}
        setDuration={setAnimDuration}
        isAnimating={drag.flip.isAnimating()}
      />

      {/* ── Selection info ─────────────────────────────────────────── */}
      <SelectionInfo selected={selection.selected()} items={items()} onClear={() => selection.clear()} />

      {/* ── Sortable list ──────────────────────────────────────────── */}
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Sortable list"
        class="relative flex flex-col gap-2 rounded-xl border border-white/10 bg-white/2 p-3"
      >
        <For each={items()}>
          {(item) => (
            <ListItem
              item={item}
              isDragged={drag.draggedIds().includes(item.id) && drag.sensor.isDragging()}
              isSelected={selection.isSelected(item.id)}
              onPointerDown={(ev) => drag.onPointerDown(item.id, ev)}
              ref={(el) => itemRefs.set(item.id, el)}
            />
          )}
        </For>

        {/* Drop indicator line */}
        <Show when={indicatorY() !== undefined}>
          <DropIndicator y={indicatorY()!} />
        </Show>
      </div>

      {/* ── Current order ─────────────────────────────────────────── */}
      <OrderDisplay items={items()} />

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

// MARK: Utils

const LOGS = {
  SELECT: (ids: string[]) => `☑ SELECT  [${ids.join(', ')}]`,
  DRAG: (ids: string[], id: string | null = '', e: { position: { x: number; y: number } }) => {
    const label = ids.length > 1 ? `[${ids.join(', ')}]` : `id="${id}"`;
    return `▶ DRAG  ${label} at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`;
  },
  DROP: (ids: string[], place: Place.Place<string> | undefined) => {
    const label = ids.length > 1 ? `[${ids.join(', ')}]` : `id="${ids[0]}"`;
    return `■ DROP  ${label} → ${Place.label(place)}`;
  },
  CANCEL: () => `✕ CANCEL`
};
