import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import { createDragSensor, createFlip, createSelection, createSortable, Place, Rect, reorderItems } from 'solid-dnd';
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

  // ── Drag state ──────────────────────────────────────────────────────────
  const [draggedIds, setDraggedIds] = createSignal<string[]>([]);
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>();
  let pendingDragId: string | null = null;

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
    draggedKeys: () => draggedIds(),
    getRect: (key) => Rect.fromElement(itemRefs.get(key)),
    getContainerRect: () => Rect.fromElement(containerRef)
  });

  // ── FLIP animation primitive ────────────────────────────────────────────
  const flip = createFlip({ elements: itemRefs as Map<string, HTMLElement> });

  // ── Throttled drop-place update (~60fps) ─────────────────────────────────
  const throttledSetDropPlace = throttle((pos: { x: number; y: number }) => {
    setDropPlace(sortable.getInsertionPoint(pos));
  }, 16);

  // ── Shared cleanup ──────────────────────────────────────────────────────
  function resetDragState() {
    throttledSetDropPlace.clear();
    pendingDragId = null;
    setDraggedIds([]);
    setDropPlace(undefined);
  }

  // ── Drag sensor ─────────────────────────────────────────────────────────
  const sensor = createDragSensor({
    threshold: 5,
    onClick: (ev) => {
      // Threshold not exceeded — this was a click, delegate to selection
      if (pendingDragId) {
        selection.handleClick(pendingDragId, ev);
        pendingDragId = null;
      }
    },
    onDragStart: (e) => {
      const id = pendingDragId;
      // If dragging a selected item, drag the whole selection; otherwise just the one
      const ids = id && selection.isSelected(id) ? selection.selected() : id ? [id] : [];
      setDraggedIds(ids);

      logger.addLog(LOGS.DRAG(ids, id, e));
      setDropPlace(sortable.getInsertionPoint(e.position));
    },
    onDragMove: (e) => {
      throttledSetDropPlace(e.position);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const ids = draggedIds();
      if (place && ids.length > 0) {
        const doReorder = () => setItems((prev) => reorderItems(prev, ids, place, (i) => i.id));
        if (animEnabled()) {
          flip.animate(doReorder, { duration: animDuration() });
        } else {
          doReorder();
        }
        logger.addLog(LOGS.DROP(ids, place));
      }
      resetDragState();
    },
    onDragCancel: () => {
      logger.addLog(LOGS.CANCEL());
      resetDragState();
    }
  });

  // ── Reactive cursor: grabbing while dragging ────────────────────────────
  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  // ── Per-item pointer down ───────────────────────────────────────────────
  function handleItemPointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Drop indicator Y position (relative to container) ─────────────────
  function indicatorY(): number | undefined {
    if (!sensor.isDragging()) return undefined;
    return sortable.getIndicatorOffset(dropPlace());
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable List</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Drag items to reorder. Click to select, Ctrl+click to toggle, Shift+click for range. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDragSensor</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createFlip</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

      {/* ── Animation controls ─────────────────────────────────────── */}
      <AnimationControls
        enabled={animEnabled()}
        setEnabled={setAnimEnabled}
        duration={animDuration()}
        setDuration={setAnimDuration}
        isAnimating={flip.isAnimating()}
      />

      {/* ── Selection info ─────────────────────────────────────────── */}
      <SelectionInfo selected={selection.selected()} items={items()} onClear={() => selection.clear()} />

      {/* ── Sortable list ──────────────────────────────────────────── */}
      <div ref={containerRef} class="relative flex flex-col gap-2 rounded-xl border border-white/10 bg-white/2 p-3">
        <For each={items()}>
          {(item) => (
            <ListItem
              item={item}
              isDragged={draggedIds().includes(item.id) && sensor.isDragging()}
              isSelected={selection.isSelected(item.id)}
              onPointerDown={(ev) => handleItemPointerDown(item.id, ev)}
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
        <StateCard label="isDragging" value={sensor.isDragging() ? 'true' : 'false'} active={sensor.isDragging()} />
        <StateCard
          label="dragging"
          value={draggedIds().length > 0 ? draggedIds().join(', ') : 'none'}
          active={draggedIds().length > 0}
        />
        <StateCard label="dropPlace" value={Place.label(dropPlace())} active={dropPlace() !== undefined} />
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
