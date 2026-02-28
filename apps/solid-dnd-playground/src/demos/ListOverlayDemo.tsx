import { createBodyCursor } from '@solid-primitives/cursor';
import {
  createDragController,
  createDropzone,
  createSelection,
  createSortable,
  GAP_KEY,
  MaybeAccessor,
  Place,
  Rect,
  reorderItems,
  type DragController,
  type FlipAnimateEntry
} from 'solid-dnd';
import { createEffect, createMemo, createSignal, For, on, Show, type Accessor, type JSX } from 'solid-js';
import { AnimationControls } from '../components/AnimationControls';
import EventLog, { createEventLogger } from '../components/EventLog';
import { FlipDebugOverlay } from '../components/FlipDebugOverlay';
import { ListItem } from '../components/ListItem';
import { ListOverlayItem } from '../components/ListOverlayItem';
import { OrderDisplay } from '../components/OrderDisplay';
import { SelectionInfo } from '../components/SelectionInfo';
import { StateCard } from '../components/StateCard';
import { createDemoItems, type DemoItem } from '../data';

// ============================================================================
// MARK: List Overlay Demo
// ============================================================================

function useListOverlayDemo(props: {
  duration: MaybeAccessor<number>;
  animEnabled: MaybeAccessor<boolean>;
  onDragStart?: (keys: string[], pos: { x: number; y: number }) => void;
  onDropLog?: (keys: string[], place: Place.Place<string>) => void;
  onCancelLog?: () => void;
  onSelectionChange?: (keys: string[]) => void;
}) {
  const [items, setItems] = createSignal(createDemoItems());
  const itemKeys = createMemo(() => items().map((i) => i.id));

  const itemRefs = new Map<string, HTMLDivElement>();
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | undefined>(undefined);

  const [flipEntries, setFlipEntries] = createSignal<FlipAnimateEntry[]>([]);

  const selection = createSelection<string>({
    items: itemKeys,
    onSelectionChange: props.onSelectionChange
  });

  const sortable = createSortable<string>({
    containerKey: 'list',
    items: itemKeys,
    draggedKeys: () => drag.draggedIds(),
    getRect: (key) => Rect.fromElement(itemRefs.get(key)),
    getContainerRect: () => Rect.fromElement(containerRef())
  });

  // ── Drag controller (sensor + overlay + FLIP) ──────────────────────────
  const drag: DragController<string> = createDragController<string>({
    elements: itemRefs as Map<string, HTMLElement>,
    getInsertionPoint: (pos) => sortable.getInsertionPoint(pos),

    onBeforeDragStart: (id) => {
      const ids = selection.isSelected(id) ? selection.selected() : [id];
      sortable.snapshotRects(ids);
      return ids;
    },

    onClick: (ev, id) => selection.handleClick(id, ev),

    onDrop: (keys, place) => {
      setItems((prev) => reorderItems(prev, keys, place, (i) => i.id));
    },

    onReset: () => {
      sortable.clearSnapshot();
      itemRefs.delete(GAP_KEY);
    },
    onDragStart: props.onDragStart,
    onDropLog: props.onDropLog,
    onCancelLog: props.onCancelLog,
    duration: props.duration,
    animEnabled: props.animEnabled,
    onFlipAnimate: setFlipEntries
  });

  const dropzone = createDropzone<string>({
    keys: itemKeys,
    draggedKeys: () => drag.draggedIds(),
    place: () => drag.dropPlace(),
    containerKey: 'list'
  });

  createEffect(
    on(
      () => dropzone.displayKeys(),
      () => {
        if (drag.sensor.isDragging()) {
          drag.flip.playFromFirst();
        }
      },
      { defer: true }
    )
  );

  const itemMap: Accessor<Map<string, DemoItem>> = createMemo(() => {
    const map = new Map<string, DemoItem>();
    for (const item of items()) map.set(item.id, item);
    return map;
  });
  function getItem(key: string): DemoItem | undefined {
    return itemMap().get(key);
  }

  return {
    items,
    selection,
    dropzone,
    drag,
    itemRefs,
    flipEntries,
    setContainerRef,
    getItem,
    isDragging: drag.sensor.isDragging,
    isAnimating: drag.flip.isAnimating
  };
}

export default function ListOverlayDemo(): JSX.Element {
  const logger = createEventLogger();

  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);
  const [debugEnabled, setDebugEnabled] = createSignal(false);

  const dnd = useListOverlayDemo({
    duration: animDuration,
    animEnabled: animEnabled,
    onSelectionChange: (keys) => {
      if (keys.length > 0) logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
    },
    onDragStart: (keys, pos) =>
      logger.addLog(`▶ DRAG  [${keys.join(', ')}] at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`),
    onDropLog: (keys, place) => logger.addLog(`■ DROP  [${keys.join(', ')}] → ${Place.label(place)}`),
    onCancelLog: () => logger.addLog('✕ CANCEL')
  });

  // ── Reactive cursor ─────────────────────────────────────────────────────
  createBodyCursor(() => (dnd.isDragging() ? 'grabbing' : null));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable List — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Items pop out as a floating overlay when dragged. A gap opens at the drop position and items animate around
          it. Combines <code class="rounded bg-white/10 px-1">createDragController</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDropzone</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

      <AnimationControls
        enabled={animEnabled()}
        setEnabled={setAnimEnabled}
        duration={animDuration()}
        setDuration={setAnimDuration}
        isAnimating={dnd.isAnimating()}
        debugEnabled={debugEnabled()}
        setDebugEnabled={setDebugEnabled}
      />

      <SelectionInfo selected={dnd.selection.selected()} items={dnd.items()} onClear={() => dnd.selection.clear()} />

      <div
        ref={dnd.setContainerRef}
        role="listbox"
        aria-label="Sortable list"
        class="relative flex flex-col gap-2 rounded-xl border border-white/10 bg-white/2 p-3"
      >
        <For each={dnd.dropzone.displayKeys()}>
          {(key) => {
            if (key === GAP_KEY) {
              return (
                <div
                  ref={(el) => dnd.itemRefs.set(GAP_KEY, el)}
                  class="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5"
                  style={{ height: `${dnd.drag.gapHeight()}px` }}
                />
              );
            }
            const item = () => dnd.getItem(key)!;
            return (
              <ListItem
                item={item()}
                isDragged={dnd.dropzone.isDragged(key) && dnd.drag.sensor.isDragging()}
                isSelected={dnd.selection.isSelected(key)}
                onPointerDown={(ev) => dnd.drag.onPointerDown(key, ev)}
                ref={(el) => dnd.itemRefs.set(key, el)}
              />
            );
          }}
        </For>
      </div>

      {/* ── Drag overlay ──────────────────────────────────────────── */}
      <Show when={dnd.drag.overlay.active()}>
        <div
          class="pointer-events-none fixed z-10000"
          style={{
            left: `${dnd.drag.overlay.position().x}px`,
            top: `${dnd.drag.overlay.position().y}px`,
            width: `${dnd.drag.overlay.size().x}px`,
            height: `${dnd.drag.overlay.size().y}px`
          }}
        >
          <ListOverlayItem items={dnd.items()} draggedIds={dnd.drag.draggedIds()} />
        </div>
      </Show>

      {/* ── FLIP debug overlay ────────────────────────────────────── */}
      <FlipDebugOverlay
        entries={dnd.flipEntries}
        elements={dnd.itemRefs as Map<string, HTMLElement>}
        isAnimating={dnd.drag.flip.isAnimating}
        enabled={debugEnabled}
        isDragging={dnd.drag.sensor.isDragging}
      />

      {/* ── Current order ─────────────────────────────────────────── */}
      <OrderDisplay items={dnd.items()} />
      {/* ── State readout ─────────────────────────────────────────── */}
      <div class="grid grid-cols-4 gap-3">
        <StateCard
          label="isDragging"
          value={dnd.drag.sensor.isDragging() ? 'true' : 'false'}
          active={dnd.drag.sensor.isDragging()}
        />
        <StateCard
          label="dragging"
          value={dnd.drag.draggedIds().length > 0 ? dnd.drag.draggedIds().join(', ') : 'none'}
          active={dnd.drag.draggedIds().length > 0}
        />
        <StateCard
          label="dropPlace"
          value={Place.label(dnd.drag.dropPlace())}
          active={dnd.drag.dropPlace() !== undefined}
        />
        <StateCard
          label="selected"
          value={dnd.selection.selected().length > 0 ? `${dnd.selection.selected().length} items` : 'none'}
          active={dnd.selection.selected().length > 0}
        />
      </div>

      {/* ── Event log ─────────────────────────────────────────────── */}
      <EventLog logger={logger} />
    </div>
  );
}
