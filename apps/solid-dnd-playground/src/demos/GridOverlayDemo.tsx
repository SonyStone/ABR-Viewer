import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import type { GridConfig } from 'solid-dnd';
import {
  createDragOverlay,
  createDragSensor,
  createDropzone,
  createFlip,
  createSelection,
  createSortable,
  GAP_KEY,
  Place,
  Rect,
  reorderItems,
  Vec2
} from 'solid-dnd';
import { createEffect, createMemo, createSignal, For, on, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { GridControls } from '../components/GridControls';
import { OrderDisplay } from '../components/OrderDisplay';
import { SelectionInfo } from '../components/SelectionInfo';
import { StateCard } from '../components/StateCard';
import { createGridItems, type DemoItem } from '../data';

// ============================================================================
// MARK: Grid Overlay Demo
// ============================================================================

export default function GridOverlayDemo(): JSX.Element {
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
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>();
  const [gapHeight, setGapHeight] = createSignal(0);
  let pendingDragId: string | null = null;

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  let containerRef: HTMLDivElement | undefined;

  // ── Animation controls ──────────────────────────────────────────────────
  const [animDuration, setAnimDuration] = createSignal(200);

  // ── Selection ───────────────────────────────────────────────────────────
  const selection = createSelection<string>({
    items: itemKeys,
    gridColumns: () => columns(),
    onSelectionChange: (keys) => {
      if (keys.length > 0) logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
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

  // ── Dropzone primitive (live gap) ───────────────────────────────────────
  const dropzone = createDropzone<string>({
    keys: itemKeys,
    draggedKeys: () => draggedIds(),
    place: dropPlace,
    containerKey: 'grid'
  });

  // ── FLIP animation ─────────────────────────────────────────────────────
  const flip = createFlip({ elements: itemRefs as Map<string, HTMLElement> });

  // ── Drag overlay ────────────────────────────────────────────────────────
  const overlay = createDragOverlay({
    currentPosition: () => sensor.position() ?? Vec2.Zero
  });

  // ── Throttled drop-place update ─────────────────────────────────────────
  const throttledSetDropPlace = throttle((pos: { x: number; y: number }) => {
    setDropPlace(sortable.getInsertionPoint(pos));
  }, 16);

  // ── Animate display key changes during drag ─────────────────────────────
  createEffect(
    on(
      () => dropzone.displayKeys(),
      () => {
        if (sensor.isDragging()) {
          flip.playFromFirst();
        }
      },
      { defer: true }
    )
  );

  // ── Shared cleanup ──────────────────────────────────────────────────────
  function resetDragState() {
    throttledSetDropPlace.clear();
    pendingDragId = null;
    setDraggedIds([]);
    setDropPlace(undefined);
    setGapHeight(0);
    overlay.stop();
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

      // 1. Measure source element BEFORE any state changes
      const sourceEl = id ? itemRefs.get(id) : undefined;
      if (sourceEl) {
        setGapHeight(sourceEl.getBoundingClientRect().height);
        overlay.start(sourceEl, e.position);
      }

      // 2. Capture FLIP positions before DOM changes
      flip.captureFirst();

      // 3. Set drag state
      setDraggedIds(ids);
      setDropPlace(sortable.getInsertionPoint(e.position));

      logger.addLog(`▶ DRAG  [${ids.join(', ')}] at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
    },
    onDragMove: (e) => {
      flip.captureFirst();
      throttledSetDropPlace(e.position);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const ids = draggedIds();
      if (place && ids.length > 0) {
        const doReorder = () => {
          setItems((prev) => reorderItems(prev, ids, place, (i) => i.id));
          resetDragState();
        };
        flip.animate(doReorder, { duration: animDuration() });
        logger.addLog(`■ DROP  [${ids.join(', ')}] → ${Place.label(place)}`);
      } else {
        flip.animate(() => resetDragState(), { duration: animDuration() });
      }
    },
    onDragCancel: () => {
      logger.addLog('✕ CANCEL');
      flip.animate(() => resetDragState(), { duration: animDuration() });
    }
  });

  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  function handleItemPointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  function getItem(key: string): DemoItem | undefined {
    return items().find((i) => i.id === key);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable Grid — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Grid items pop out as a floating overlay when dragged. A gap opens at the drop position. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDropzone</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDragOverlay</code> with the grid sortable.
        </p>
      </div>

      {/* ── Grid controls ──────────────────────────────────────────── */}
      <GridControls
        columns={columns()}
        setColumns={setColumns}
        animDuration={animDuration()}
        setAnimDuration={setAnimDuration}
        isAnimating={flip.isAnimating()}
      />

      {/* ── Selection info ─────────────────────────────────────────── */}
      <SelectionInfo
        selected={selection.selected()}
        items={items()}
        onClear={() => selection.clear()}
        hint="Click to select · Ctrl+click toggle · Shift+click rectangular range"
      />

      {/* ── Grid container ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        class="relative rounded-xl border border-white/10 bg-white/2 p-3"
        style={{ display: 'grid', 'grid-template-columns': `repeat(${columns()}, 1fr)`, gap: '8px' }}
      >
        <For each={dropzone.displayKeys()}>
          {(key) => {
            if (key === GAP_KEY) {
              return (
                <div
                  ref={(el) => itemRefs.set(GAP_KEY, el)}
                  class="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5"
                  style={{ height: `${gapHeight()}px` }}
                />
              );
            }
            const item = () => getItem(key)!;
            return (
              <GridItem
                item={item()}
                isDragged={dropzone.isDragged(key) && sensor.isDragging()}
                isSelected={selection.isSelected(key)}
                onPointerDown={(ev) => handleItemPointerDown(key, ev)}
                ref={(el) => itemRefs.set(key, el)}
              />
            );
          }}
        </For>
      </div>

      {/* ── Drag overlay ──────────────────────────────────────────── */}
      <Show when={overlay.active()}>
        <div
          class="pointer-events-none fixed z-[10000]"
          style={{
            left: `${overlay.position().x}px`,
            top: `${overlay.position().y}px`,
            width: `${overlay.size().x}px`
          }}
        >
          <GridOverlayItem items={items()} draggedIds={draggedIds()} />
        </div>
      </Show>

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

      <EventLog logger={logger} />
    </div>
  );
}

// ============================================================================
// MARK: Sub-Components
// ============================================================================

function GridItem(props: {
  item: DemoItem;
  isDragged: boolean;
  isSelected: boolean;
  onPointerDown: (ev: PointerEvent) => void;
  ref: (el: HTMLDivElement) => void;
}): JSX.Element {
  const baseClass =
    'flex cursor-grab touch-none flex-col items-center gap-2 rounded-lg border p-4 select-none active:cursor-grabbing';

  const stateClass = () => {
    if (props.isDragged) {
      return 'border-transparent bg-transparent opacity-0 !h-0 overflow-hidden !p-0 !m-0';
    }
    if (props.isSelected) {
      return 'border-purple-500/40 bg-purple-500/10 ring-1 ring-purple-500/20';
    }
    return 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8';
  };

  return (
    <div ref={props.ref} onPointerDown={props.onPointerDown} class={`${baseClass} ${stateClass()}`}>
      <div class="h-8 w-8 rounded" style={{ background: props.item.color }} />
      <span class={`text-xs ${props.isSelected ? 'text-purple-200' : 'text-neutral-300'}`}>{props.item.label}</span>
      <span class="font-mono text-[10px] text-neutral-500">{props.item.id}</span>
    </div>
  );
}

function GridOverlayItem(props: { items: DemoItem[]; draggedIds: string[] }): JSX.Element {
  const primary = () => props.items.find((i) => props.draggedIds.includes(i.id));

  return (
    <Show when={primary()}>
      {(item) => (
        <div class="flex flex-col items-center gap-2 rounded-lg border border-blue-500/50 bg-neutral-800 p-4 shadow-xl shadow-blue-500/10">
          <div class="h-8 w-8 rounded" style={{ background: item().color }} />
          <span class="text-xs text-neutral-200">{item().label}</span>
          <Show when={props.draggedIds.length > 1}>
            <span class="text-[10px] text-blue-400/70">+{props.draggedIds.length - 1} more</span>
          </Show>
        </div>
      )}
    </Show>
  );
}
