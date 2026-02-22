import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
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
import { AnimationControls } from '../components/AnimationControls';
import EventLog, { createEventLogger } from '../components/EventLog';
import { OrderDisplay } from '../components/OrderDisplay';
import { SelectionInfo } from '../components/SelectionInfo';
import { StateCard } from '../components/StateCard';
import { createDemoItems, type DemoItem } from '../data';

// ============================================================================
// MARK: List Overlay Demo
// ============================================================================

export default function ListOverlayDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── Item state ──────────────────────────────────────────────────────────
  const [items, setItems] = createSignal(createDemoItems());
  const itemKeys = createMemo(() => items().map((i) => i.id));

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
    onSelectionChange: (keys) => {
      if (keys.length > 0) logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
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

  // ── Dropzone primitive (live gap) ───────────────────────────────────────
  const dropzone = createDropzone<string>({
    keys: itemKeys,
    draggedKeys: () => draggedIds(),
    place: dropPlace,
    containerKey: 'list'
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

      // 3. Set drag state (triggers display key changes → items get collapsed class)
      setDraggedIds(ids);

      // 4. Set drop place (triggers gap insertion → displayKeys changes → effect fires playFromFirst)
      setDropPlace(sortable.getInsertionPoint(e.position));

      logger.addLog(`▶ DRAG  [${ids.join(', ')}] at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
    },
    onDragMove: (e) => {
      // Capture before place changes (so FLIP sees the old positions)
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

  // ── Reactive cursor ─────────────────────────────────────────────────────
  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  // ── Per-item pointer down ───────────────────────────────────────────────
  function handleItemPointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Helper: look up item data by key ────────────────────────────────────
  function getItem(key: string): DemoItem | undefined {
    return items().find((i) => i.id === key);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable List — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Items pop out as a floating overlay when dragged. A gap opens at the drop position and items animate around
          it. Combines <code class="rounded bg-white/10 px-1">createDragSensor</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDropzone</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDragOverlay</code> +{' '}
          <code class="rounded bg-white/10 px-1">createFlip</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

      {/* ── Animation controls ─────────────────────────────────────── */}
      <AnimationControls duration={animDuration()} setDuration={setAnimDuration} isAnimating={flip.isAnimating()} />

      {/* ── Selection info ─────────────────────────────────────────── */}
      <SelectionInfo selected={selection.selected()} items={items()} onClear={() => selection.clear()} />

      {/* ── Sortable list ──────────────────────────────────────────── */}
      <div ref={containerRef} class="relative flex flex-col gap-2 rounded-xl border border-white/10 bg-white/2 p-3">
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
              <ListItem
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
          <OverlayItem items={items()} draggedIds={draggedIds()} />
        </div>
      </Show>

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

// ============================================================================
// MARK: Sub-Components
// ============================================================================

function ListItem(props: {
  item: DemoItem;
  isDragged: boolean;
  isSelected: boolean;
  onPointerDown: (ev: PointerEvent) => void;
  ref: (el: HTMLDivElement) => void;
}): JSX.Element {
  const baseClass =
    'flex cursor-grab touch-none items-center gap-3 rounded-lg border px-4 py-3 transition-shadow select-none';

  const stateClass = () => {
    if (props.isDragged) {
      // Item is being dragged — collapse it (but keep in DOM for pointer capture!)
      return 'border-transparent bg-transparent opacity-0 !h-0 overflow-hidden !py-0 !my-0';
    }
    if (props.isSelected) {
      return 'border-purple-500/40 bg-purple-500/10 ring-1 ring-purple-500/20 hover:border-purple-400/50';
    }
    return 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8';
  };

  return (
    <div ref={props.ref} onPointerDown={props.onPointerDown} class={`${baseClass} ${stateClass()}`}>
      <Show
        when={props.isSelected}
        fallback={
          <svg class="h-4 w-4 shrink-0 text-neutral-500" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.2" />
            <circle cx="11" cy="3" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="13" r="1.2" />
            <circle cx="11" cy="13" r="1.2" />
          </svg>
        }
      >
        <svg class="h-4 w-4 shrink-0 text-purple-400" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      </Show>
      <div class="h-3 w-3 shrink-0 rounded-full" style={{ background: props.item.color }} />
      <span class={`text-sm ${props.isSelected ? 'text-purple-200' : 'text-neutral-200'}`}>{props.item.label}</span>
      <span class="ml-auto font-mono text-xs text-neutral-500">{props.item.id}</span>
    </div>
  );
}

/** Floating overlay showing the dragged item(s). */
function OverlayItem(props: { items: DemoItem[]; draggedIds: string[] }): JSX.Element {
  const draggedItems = () => props.items.filter((i) => props.draggedIds.includes(i.id));

  return (
    <div class="flex flex-col gap-1">
      <For each={draggedItems()}>
        {(item, i) => (
          <div
            class="flex items-center gap-3 rounded-lg border border-blue-500/50 bg-neutral-800 px-4 py-3 shadow-xl shadow-blue-500/10"
            style={{
              opacity: i() === 0 ? 1 : Math.max(0.3, 1 - i() * 0.2),
              transform: i() > 0 ? `translate(${i() * 4}px, ${i() * 2}px)` : undefined
            }}
          >
            <svg class="h-4 w-4 shrink-0 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.2" />
              <circle cx="11" cy="3" r="1.2" />
              <circle cx="5" cy="8" r="1.2" />
              <circle cx="11" cy="8" r="1.2" />
              <circle cx="5" cy="13" r="1.2" />
              <circle cx="11" cy="13" r="1.2" />
            </svg>
            <div class="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color }} />
            <span class="text-sm text-neutral-200">{item.label}</span>
            <span class="ml-auto font-mono text-xs text-neutral-500">{item.id}</span>
          </div>
        )}
      </For>
      <Show when={props.draggedIds.length > 1}>
        <div class="mt-1 text-center text-xs text-blue-400/70">{props.draggedIds.length} items</div>
      </Show>
    </div>
  );
}
