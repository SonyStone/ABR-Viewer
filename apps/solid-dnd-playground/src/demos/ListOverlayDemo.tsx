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
import { ListItem } from '../components/ListItem';
import { ListOverlayItem } from '../components/ListOverlayItem';
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
  const [animEnabled, setAnimEnabled] = createSignal(true);
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
        if (sensor.isDragging() && animEnabled()) {
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
    proxyCapture: true,
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
      if (animEnabled()) flip.captureFirst();

      // 3. Set drag state (triggers display key changes → items get collapsed class)
      setDraggedIds(ids);

      // 4. Set drop place (triggers gap insertion → displayKeys changes → effect fires playFromFirst)
      setDropPlace(sortable.getInsertionPoint(e.position));

      logger.addLog(`▶ DRAG  [${ids.join(', ')}] at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
    },
    onDragMove: (e) => {
      // Capture before place changes (so FLIP sees the old positions)
      if (animEnabled()) flip.captureFirst();
      throttledSetDropPlace(e.position);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const ids = draggedIds();
      const dur = animEnabled() ? animDuration() : 0;
      if (place && ids.length > 0) {
        const doReorder = () => {
          setItems((prev) => reorderItems(prev, ids, place, (i) => i.id));
          resetDragState();
        };
        flip.animate(doReorder, { duration: dur });
        logger.addLog(`■ DROP  [${ids.join(', ')}] → ${Place.label(place)}`);
      } else {
        flip.animate(() => resetDragState(), { duration: dur });
      }
    },
    onDragCancel: () => {
      logger.addLog('✕ CANCEL');
      flip.animate(() => resetDragState(), { duration: animEnabled() ? animDuration() : 0 });
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
          <ListOverlayItem items={items()} draggedIds={draggedIds()} />
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
