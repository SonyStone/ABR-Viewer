import { createBodyCursor } from '@solid-primitives/cursor';
import type { GapKey, GridConfig, MaybeAccessor } from 'solid-dnd';
import {
  createDisplayList,
  createDragController,
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

function useGridOverlayDemo(props: {
  duration: MaybeAccessor<number>;
  columns: MaybeAccessor<number>;
  animEnabled: MaybeAccessor<boolean>;
  gridConfig: MaybeAccessor<GridConfig>;
  onDragStart?: (keys: ReadonlyArray<string>, pos: { x: number; y: number }) => void;
  onDropLog?: (keys: ReadonlyArray<string | GapKey>, place: Place.Place<string | GapKey>) => void;
  onCancelLog?: () => void;
  onSelectionChange?: (keys: ReadonlyArray<string | GapKey>) => void;
}) {
  const [items, setItems] = createSignal(createGridItems());
  const itemKeys = createMemo(() => items().map((i) => i.id));

  const itemRefs = new Map<string | GapKey, HTMLDivElement>();
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | undefined>(undefined);

  const [flipEntries, setFlipEntries] = createSignal<FlipAnimateEntry<string | GapKey>[]>([]);

  const selection = createSelection<string | GapKey>({
    items: itemKeys,
    gridColumns: props.columns,
    onSelectionChange: props.onSelectionChange
  });

  const sortable = createSortable<string | GapKey>({
    containerKey: 'grid',
    items: itemKeys,
    layout: 'grid',
    gridConfig: props.gridConfig,
    draggedKeys: () => drag.draggedIds(),
    getRect: (key) => Rect.fromElement(itemRefs.get(key)),
    getContainerRect: () => Rect.fromElement(containerRef())
  });

  const drag: DragController<string | GapKey> = createDragController<string | GapKey>({
    elements: itemRefs as Map<string | GapKey, HTMLElement>,
    getInsertionPoint: (pos) => sortable.getInsertionPoint(pos),
    onBeforeDragStart: (id) => {
      const ids = selection.isSelected(id) ? selection.selected() : [id];
      sortable.snapshotRects(ids);
      return ids;
    },
    onClick: (ev, id) => selection.handleClick(id, ev),
    onDrop: (keys, place) => {
      setItems((prev) => reorderItems(prev, keys, place, (i) => i.id));
      props.onDropLog?.(keys, place);
    },
    onReset: () => {
      sortable.clearSnapshot();
      itemRefs.delete(GAP_KEY);
    },
    onDragStart: props.onDragStart,
    onCancel: props.onCancelLog,
    duration: props.duration,
    animEnabled: props.animEnabled,
    onFlipAnimate: setFlipEntries
  });

  const display = createDisplayList<string | GapKey>({
    keys: itemKeys,
    draggedKeys: () => drag.draggedIds(),
    place: () => drag.dropPlace(),
    containerKey: 'grid'
  });

  createEffect(
    on(
      () => display.displayKeys(),
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

  createBodyCursor(() => (drag.sensor.isDragging() ? 'grabbing' : null));

  return {
    items,
    setItems,
    itemKeys,
    itemRefs,
    setContainerRef,
    flipEntries,
    selection,
    sortable,
    drag,
    display,
    getItem,
    isDragging: drag.sensor.isDragging,
    isAnimating: drag.flip.isAnimating
  };
}

export default function GridOverlayDemo(): JSX.Element {
  const logger = createEventLogger();

  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);
  const [debugEnabled, setDebugEnabled] = createSignal(false);
  const [columns, setColumns] = createSignal(4);
  const gridConfig = createMemo<GridConfig>(() => ({
    columns: columns(),
    gap: 8,
    rowHeight: 'auto'
  }));

  const dnd = useGridOverlayDemo({
    duration: animDuration,
    animEnabled: animEnabled,
    columns: columns,
    gridConfig: gridConfig,
    onDragStart: (keys, pos) => {
      logger.addLog(`▶ DRAG  [${keys.join(', ')}] at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
    },
    onDropLog: (keys, place) => {
      logger.addLog(`■ DROP  [${keys.join(', ')}] → ${Place.label(place)}`);
    },
    onCancelLog: () => logger.addLog('✕ CANCEL'),
    onSelectionChange: (keys) => {
      if (keys.length > 0) logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
    }
  });

  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Sortable Grid — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Grid items pop out as a floating overlay when dragged. A gap opens at the drop position. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDragController</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSortable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDisplayList</code> +{' '}
          <code class="rounded bg-white/10 px-1">createSelection</code>.
        </p>
      </div>

      <SelectionInfo
        selected={dnd.selection.selected()}
        items={dnd.items()}
        onClear={() => dnd.selection.clear()}
        hint="Click to select · Ctrl+click toggle · Shift+click rectangular range"
      />

      {/*  Grid container  */}
      <div
        ref={dnd.setContainerRef}
        role="listbox"
        aria-label="Sortable grid"
        class="relative rounded-xl border border-white/10 bg-white/2 p-3"
        style={{ display: 'grid', 'grid-template-columns': `repeat(${columns()}, 1fr)`, gap: '8px' }}
      >
        <For each={dnd.display.displayKeys()}>
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
              <GridItem
                item={item()}
                isDragged={dnd.display.isDragged(key) && dnd.drag.sensor.isDragging()}
                isSelected={dnd.selection.isSelected(key)}
                onPointerDown={(ev) => dnd.drag.onPointerDown(key, ev)}
                ref={(el) => dnd.itemRefs.set(key, el)}
              />
            );
          }}
        </For>
      </div>

      <GridControls
        columns={columns()}
        setColumns={setColumns}
        animEnabled={animEnabled()}
        setAnimEnabled={setAnimEnabled}
        animDuration={animDuration()}
        setAnimDuration={setAnimDuration}
        isAnimating={dnd.drag.flip.isAnimating()}
        debugEnabled={debugEnabled()}
        setDebugEnabled={setDebugEnabled}
      />

      {/*  Drag overlay  */}
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
          <GridOverlayItem items={dnd.items()} draggedIds={dnd.drag.draggedIds()} />
        </div>
      </Show>

      <FlipDebugOverlay
        entries={dnd.flipEntries}
        elements={dnd.itemRefs as Map<string, HTMLElement>}
        isAnimating={dnd.drag.flip.isAnimating}
        enabled={debugEnabled}
        isDragging={dnd.drag.sensor.isDragging}
        debugContext={() =>
          dnd.drag.sensor.isDragging()
            ? {
                dragging: dnd.drag.draggedIds(),
                place: Place.label(dnd.drag.dropPlace()),
                pointer: dnd.drag.sensor.position(),
                columns: columns(),
                items: dnd.items(),
                displayKeys: dnd.display.displayKeys()
              }
            : undefined
        }
      />

      <OrderDisplay items={dnd.items()} columns={columns()} />

      {/* State readout  */}
      <div class="grid grid-cols-4 gap-3">
        <StateCard label="isDragging" value={dnd.isDragging() ? 'true' : 'false'} active={dnd.isDragging()} />
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

      <EventLog logger={logger} />
    </div>
  );
}
