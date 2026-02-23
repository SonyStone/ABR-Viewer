import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import type { GridConfig } from 'solid-dnd';
import { createDragSensor, createFlip, createSelection, createSortable, Place, Rect, reorderItems } from 'solid-dnd';
import { batch, createMemo, createSignal, For, Show, type JSX } from 'solid-js';
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
 * Interactive grid demo combining createDragSensor + createSortable (grid mode)
 * + createFlip + createSelection (with grid range selection).
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

  // ── Drag state ──────────────────────────────────────────────────────────
  const [draggedIds, setDraggedIds] = createSignal<string[]>([]);
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>(undefined, {
    equals: Place.equals
  });
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
    gridConfig: gridConfig(),
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
      if (pendingDragId) {
        selection.handleClick(pendingDragId, ev);
        pendingDragId = null;
      }
    },
    onDragStart: (e) => {
      const id = pendingDragId;
      const ids = id && selection.isSelected(id) ? selection.selected() : id ? [id] : [];
      batch(() => {
        setDraggedIds(ids);
        logger.addLog(`▶ DRAG  [${ids.join(', ')}] at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
        setDropPlace(sortable.getInsertionPoint(e.position));
      });
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
        logger.addLog(`■ DROP  [${ids.join(', ')}] → ${Place.label(place)}`);
      }
      resetDragState();
    },
    onDragCancel: () => {
      logger.addLog('✕ CANCEL');
      resetDragState();
    }
  });

  // ── Reactive cursor ─────────────────────────────────────────────────────
  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  // ── Per-item pointer down ───────────────────────────────────────────────
  function handleItemPointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Grid indicator position ─────────────────────────────────────────────
  function indicatorPos() {
    if (!sensor.isDragging()) return undefined;
    return sortable.getGridIndicator(dropPlace());
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable Grid</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Drag items to reorder in a grid. Click to select, Ctrl+click to toggle, Shift+click for rectangular range.
          Combines <code class="rounded bg-white/10 px-1">createSortable</code> (grid mode) +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code> (grid range) +{' '}
          <code class="rounded bg-white/10 px-1">createFlip</code>.
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
        isAnimating={flip.isAnimating()}
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
        class="relative rounded-xl border border-white/10 bg-white/2 p-3"
        style={{ display: 'grid', 'grid-template-columns': `repeat(${columns()}, 1fr)`, gap: '8px' }}
      >
        <For each={items()}>
          {(item) => (
            <GridItem
              item={item}
              isDragged={draggedIds().includes(item.id) && sensor.isDragging()}
              isSelected={selection.isSelected(item.id)}
              onPointerDown={(ev) => handleItemPointerDown(item.id, ev)}
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
