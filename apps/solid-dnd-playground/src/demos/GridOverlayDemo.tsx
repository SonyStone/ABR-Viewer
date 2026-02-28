import { createBodyCursor } from '@solid-primitives/cursor';
import type { GridConfig } from 'solid-dnd';
import {
  createDragController,
  createDropzone,
  createSelection,
  createSortable,
  GAP_KEY,
  Place,
  Rect,
  reorderItems,
  type DragController,
  type FlipAnimateEntry
} from 'solid-dnd';
import { createEffect, createMemo, createSignal, For, on, Show, type Accessor, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { FlipDebugOverlay } from '../components/FlipDebugOverlay';
import { GridControls } from '../components/GridControls';
import { GridItem } from '../components/GridItem';
import { GridOverlayItem } from '../components/GridOverlayItem';
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

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  let containerRef: HTMLDivElement | undefined;

  // ── Animation controls ──────────────────────────────────────────────────
  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);
  const [debugEnabled, setDebugEnabled] = createSignal(false);
  const [flipEntries, setFlipEntries] = createSignal<FlipAnimateEntry[]>([]);

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

    onDragStart: (keys, pos) => {
      logger.addLog(`▶ DRAG  [${keys.join(', ')}] at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
    },

    onDropLog: (keys, place) => {
      logger.addLog(`■ DROP  [${keys.join(', ')}] → ${Place.label(place)}`);
    },

    onCancelLog: () => logger.addLog('✕ CANCEL'),

    duration: () => animDuration(),
    animEnabled: () => animEnabled(),
    onFlipAnimate: (entries) => setFlipEntries(entries)
  });

  // ── Dropzone primitive (live gap) ───────────────────────────────────────
  const dropzone = createDropzone<string>({
    keys: itemKeys,
    draggedKeys: () => drag.draggedIds(),
    place: () => drag.dropPlace(),
    containerKey: 'grid'
  });

  // ── FLIP on displayKeys change during drag ───────────────────────────
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

  // ── Reactive cursor ─────────────────────────────────────────────────────
  createBodyCursor(() => (drag.sensor.isDragging() ? 'grabbing' : null));

  // ── Memoized item lookup (O(1) per key instead of O(n)) ─────────────────
  const itemMap: Accessor<Map<string, DemoItem>> = createMemo(() => {
    const map = new Map<string, DemoItem>();
    for (const item of items()) map.set(item.id, item);
    return map;
  });
  function getItem(key: string): DemoItem | undefined {
    return itemMap().get(key);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable Grid — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Grid items pop out as a floating overlay when dragged. A gap opens at the drop position. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDragController</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDropzone</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

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
        role="listbox"
        aria-label="Sortable grid"
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
                  style={{ height: `${drag.gapHeight()}px` }}
                />
              );
            }
            const item = () => getItem(key)!;
            return (
              <GridItem
                item={item()}
                isDragged={dropzone.isDragged(key) && drag.sensor.isDragging()}
                isSelected={selection.isSelected(key)}
                onPointerDown={(ev) => drag.onPointerDown(key, ev)}
                ref={(el) => itemRefs.set(key, el)}
              />
            );
          }}
        </For>
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
        debugEnabled={debugEnabled()}
        setDebugEnabled={setDebugEnabled}
      />

      {/* ── Drag overlay ──────────────────────────────────────────── */}
      <Show when={drag.overlay.active()}>
        <div
          class="pointer-events-none fixed z-10000"
          style={{
            left: `${drag.overlay.position().x}px`,
            top: `${drag.overlay.position().y}px`,
            width: `${drag.overlay.size().x}px`,
            height: `${drag.overlay.size().y}px`
          }}
        >
          <GridOverlayItem items={items()} draggedIds={drag.draggedIds()} />
        </div>
      </Show>

      {/* ── FLIP debug overlay ────────────────────────────────────── */}
      <FlipDebugOverlay
        entries={flipEntries}
        elements={itemRefs as Map<string, HTMLElement>}
        isAnimating={drag.flip.isAnimating}
        enabled={debugEnabled}
        isDragging={drag.sensor.isDragging}
        debugContext={() =>
          drag.sensor.isDragging()
            ? {
                dragging: drag.draggedIds(),
                place: Place.label(drag.dropPlace()),
                pointer: drag.sensor.position(),
                columns: columns(),
                items: itemKeys(),
                displayKeys: dropzone.displayKeys()
              }
            : undefined
        }
      />

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

      <EventLog logger={logger} />
    </div>
  );
}
