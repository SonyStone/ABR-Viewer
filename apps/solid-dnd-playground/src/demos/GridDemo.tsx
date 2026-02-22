import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import type { GridConfig } from 'solid-dnd';
import { createDragSensor, createFlip, createSelection, createSortable, Place, Rect, reorderItems } from 'solid-dnd';
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { type DemoItem } from '../data';

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
      setDraggedIds(ids);
      logger.addLog(`▶ DRAG  [${ids.join(', ')}] at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
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
      <SelectionInfo selected={selection.selected()} items={items()} onClear={() => selection.clear()} />

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
              isDragged={draggedIds().includes(item.id)}
              isDragging={sensor.isDragging()}
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

// ============================================================================
// MARK: Sub-Components
// ============================================================================

function GridItem(props: {
  item: DemoItem;
  isDragged: boolean;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (ev: PointerEvent) => void;
  ref: (el: HTMLDivElement) => void;
}): JSX.Element {
  const baseClass =
    'flex cursor-grab touch-none flex-col items-center gap-2 rounded-lg border p-4 transition-all select-none active:cursor-grabbing';

  const stateClass = () => {
    if (props.isDragged && props.isDragging) {
      return 'border-blue-500/30 bg-blue-500/10 opacity-40';
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

function GridDropIndicator(props: { x: number; y: number; height: number }): JSX.Element {
  return (
    <div
      class="pointer-events-none absolute z-10"
      style={{
        left: `${props.x}px`,
        top: `${props.y}px`,
        width: '3px',
        height: `${props.height}px`,
        transform: 'translateX(-1.5px)'
      }}
    >
      <div class="h-full w-full rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
      {/* Top dot */}
      <div class="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
      {/* Bottom dot */}
      <div class="absolute -bottom-1 -left-1 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
    </div>
  );
}

function GridControls(props: {
  columns: number;
  setColumns: (v: number) => void;
  animEnabled: boolean;
  setAnimEnabled: (v: boolean) => void;
  animDuration: number;
  setAnimDuration: (v: number) => void;
  isAnimating: boolean;
}): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      {/* Columns */}
      <label class="flex items-center gap-2 text-xs text-neutral-400">
        Columns
        <input
          type="range"
          min="2"
          max="6"
          step="1"
          value={props.columns}
          onInput={(e) => props.setColumns(Number(e.currentTarget.value))}
          class="h-1 w-20 cursor-pointer accent-blue-500"
        />
        <span class="w-4 font-mono text-neutral-300">{props.columns}</span>
      </label>

      {/* Animation toggle */}
      <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={props.animEnabled}
          onChange={(e) => props.setAnimEnabled(e.currentTarget.checked)}
          class="accent-blue-500"
        />
        FLIP animation
      </label>

      {/* Duration */}
      <label class="flex items-center gap-2 text-xs text-neutral-400">
        Duration
        <input
          type="range"
          min="50"
          max="800"
          step="10"
          value={props.animDuration}
          onInput={(e) => props.setAnimDuration(Number(e.currentTarget.value))}
          class="h-1 w-24 cursor-pointer accent-blue-500"
          disabled={!props.animEnabled}
        />
        <span class="w-12 font-mono text-neutral-300">{props.animDuration}ms</span>
      </label>

      <Show when={props.isAnimating}>
        <span class="text-xs text-blue-400">⟳ animating…</span>
      </Show>
    </div>
  );
}

function SelectionInfo(props: { selected: string[]; items: DemoItem[]; onClear: () => void }): JSX.Element {
  const count = () => props.selected.length;

  return (
    <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <span class="text-xs text-neutral-500">Selection:</span>

      <Show
        when={count() > 0}
        fallback={
          <span class="text-xs text-neutral-500 italic">
            Click items to select · Ctrl+click to multi-select · Shift+click for rectangular range
          </span>
        }
      >
        <div class="flex flex-wrap gap-1">
          <For each={props.selected}>
            {(id) => {
              const item = props.items.find((i) => i.id === id);
              return (
                <span class="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-xs text-purple-300">
                  <div class="h-2 w-2 rounded-full" style={{ background: item?.color ?? '#666' }} />
                  {item?.label ?? id}
                </span>
              );
            }}
          </For>
        </div>

        <button
          onClick={props.onClear}
          class="ml-auto cursor-pointer rounded px-2 py-0.5 text-xs text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
        >
          Clear
        </button>
      </Show>
    </div>
  );
}

function OrderDisplay(props: { items: DemoItem[]; columns: number }): JSX.Element {
  return (
    <div class="flex flex-col gap-1">
      <span class="text-xs text-neutral-500">Order ({props.columns} columns):</span>
      <div class="flex flex-wrap gap-1" style={{ 'max-width': `${props.columns * 32 + (props.columns - 1) * 4}px` }}>
        <For each={props.items}>
          {(item) => (
            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white"
              style={{ background: item.color }}
            >
              {item.id}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

function StateCard(props: { label: string; value: string; active?: boolean }): JSX.Element {
  return (
    <div
      class={`rounded-lg border p-3 ${
        props.active ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <div class="mb-1 text-xs text-neutral-500">{props.label}</div>
      <div class={`font-mono text-sm ${props.active ? 'text-blue-300' : 'text-neutral-300'}`}>{props.value}</div>
    </div>
  );
}

// ============================================================================
// MARK: Data
// ============================================================================

function createGridItems(): DemoItem[] {
  const colors = [
    '#e74c3c',
    '#3498db',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#e67e22',
    '#2980b9',
    '#c0392b',
    '#27ae60',
    '#8e44ad',
    '#d35400'
  ];
  return colors.map((color, i) => ({
    id: String(i + 1),
    label: `Item ${i + 1}`,
    color
  }));
}
