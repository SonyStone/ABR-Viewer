import type { Place, Rect } from 'solid-dnd';
import { createDragSensor, createFlip, createSelection, createSortable, RectUtils } from 'solid-dnd';
import { createSignal, For, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { createDemoItems, type DemoItem } from '../data';

// ============================================================================
// MARK: List Demo
// ============================================================================

export default function ListDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── Item state ──────────────────────────────────────────────────────────
  const [items, setItems] = createSignal(createDemoItems());

  // ── Drag state ──────────────────────────────────────────────────────────
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [draggedIds, setDraggedIds] = createSignal<string[]>([]);
  const [dropPlace, setDropPlace] = createSignal<Place<string> | undefined>();
  let didDrag = false;

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  let containerRef: HTMLDivElement | undefined;

  // ── Animation controls ──────────────────────────────────────────────────
  const [animEnabled, setAnimEnabled] = createSignal(true);
  const [animDuration, setAnimDuration] = createSignal(200);

  // ── Selection ───────────────────────────────────────────────────────────
  const selection = createSelection<string>({
    items: () => items().map((i) => i.id),
    onSelectionChange: (keys) => {
      if (keys.length > 0) {
        logger.addLog(`☑ SELECT  [${keys.join(', ')}]`);
      }
    }
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  function domRect(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return RectUtils.of(r.x, r.y, r.width, r.height);
  }

  function placeLabel(place: Place<string> | undefined): string {
    if (!place) return 'none';
    return place.before !== null ? `before "${place.before}"` : 'append';
  }

  // ── Sortable primitive ──────────────────────────────────────────────────
  const sortable = createSortable<string>({
    containerKey: 'list',
    items: () => items().map((i) => i.id),
    getRect: (key) => {
      const el = itemRefs.get(key);
      return el ? domRect(el) : undefined;
    },
    getContainerRect: () => (containerRef ? domRect(containerRef) : undefined)
  });

  // ── FLIP animation primitive ────────────────────────────────────────────
  const flipOpts = { elements: itemRefs as Map<string, HTMLElement>, duration: animDuration() };
  const flip = createFlip(flipOpts);

  // ── Drag sensor ─────────────────────────────────────────────────────────
  const sensor = createDragSensor({
    threshold: 5,
    onDragStart: (e) => {
      didDrag = true;
      const id = draggedId();
      // If dragging a selected item, drag the whole selection; otherwise just the one
      const ids = id && selection.isSelected(id) ? selection.selected() : id ? [id] : [];
      setDraggedIds(ids);
      const label = ids.length > 1 ? `[${ids.join(', ')}]` : `id="${id}"`;
      logger.addLog(`▶ DRAG  ${label} at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
      setDropPlace(sortable.getInsertionPoint(e.position));
    },
    onDragMove: (e) => {
      const place = sortable.getInsertionPoint(e.position);
      setDropPlace(place);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const ids = draggedIds();
      if (place && ids.length > 0) {
        // FLIP: capture positions before DOM change
        if (animEnabled()) {
          flipOpts.duration = animDuration();
          flip.captureFirst();
        }
        reorderItems(ids, place);
        // FLIP: animate from old positions to new positions
        if (animEnabled()) flip.playFromFirst();
        const label = ids.length > 1 ? `[${ids.join(', ')}]` : `id="${ids[0]}"`;
        logger.addLog(`■ DROP  ${label} → ${placeLabel(place)}`);
      }
      setDraggedId(null);
      setDraggedIds([]);
      setDropPlace(undefined);
    },
    onDragCancel: () => {
      logger.addLog(`✕ CANCEL  id="${draggedId()}"`);
      setDraggedId(null);
      setDraggedIds([]);
      setDropPlace(undefined);
    }
  });

  // ── Per-item pointer down ───────────────────────────────────────────────
  function handleItemPointerDown(id: string, ev: PointerEvent) {
    didDrag = false;
    setDraggedId(id);
    sensor.onPointerDown(ev);
  }

  // ── Per-item click (fires after pointerUp if not dragged) ──────────────
  function handleItemClick(id: string, ev: PointerEvent) {
    // If sensor is still dragging or a drag just completed, skip selection
    if (sensor.isDragging() || didDrag) return;
    selection.handleClick(id, ev);
  }

  // ── Reorder logic (supports moving multiple items as a group) ──────────
  function reorderItems(movedIds: string[], place: Place<string>) {
    setItems((prev) => {
      const movedSet = new Set(movedIds);
      // Preserve the original order of moved items
      const moved = prev.filter((i) => movedSet.has(i.id));
      if (moved.length === 0) return prev;

      const without = prev.filter((i) => !movedSet.has(i.id));

      if (place.before === null) {
        return [...without, ...moved];
      }

      const idx = without.findIndex((i) => i.id === place.before);
      if (idx === -1) return [...without, ...moved];

      return [...without.slice(0, idx), ...moved, ...without.slice(idx)];
    });
  }

  // ── Drop indicator Y position (relative to container) ─────────────────
  function indicatorY(): number | undefined {
    const place = dropPlace();
    if (!place || !containerRef || !sensor.isDragging()) return undefined;

    const containerTop = containerRef.getBoundingClientRect().y;

    if (place.before !== null) {
      const el = itemRefs.get(place.before);
      if (!el) return undefined;
      return el.getBoundingClientRect().y - containerTop;
    }

    // Append: bottom of last item
    const all = items();
    if (all.length === 0) return 0;
    const lastEl = itemRefs.get(all[all.length - 1].id);
    if (!lastEl) return undefined;
    const r = lastEl.getBoundingClientRect();
    return r.y + r.height - containerTop;
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
              isDragged={draggedIds().includes(item.id)}
              isDragging={sensor.isDragging()}
              isSelected={selection.isSelected(item.id)}
              onPointerDown={(ev) => handleItemPointerDown(item.id, ev)}
              onPointerUp={(ev) => handleItemClick(item.id, ev)}
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
        <StateCard label="draggedId" value={draggedId() ?? 'none'} active={!!draggedId()} />
        <StateCard label="dropPlace" value={placeLabel(dropPlace())} active={dropPlace() !== undefined} />
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
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (ev: PointerEvent) => void;
  onPointerUp: (ev: PointerEvent) => void;
  ref: (el: HTMLDivElement) => void;
}): JSX.Element {
  const baseClass =
    'flex cursor-grab touch-none items-center gap-3 rounded-lg border px-4 py-3 transition-all select-none active:cursor-grabbing';

  const stateClass = () => {
    if (props.isDragged && props.isDragging) {
      return 'border-blue-500/30 bg-blue-500/10 opacity-40';
    }
    if (props.isSelected) {
      return 'border-purple-500/40 bg-purple-500/10 ring-1 ring-purple-500/20 hover:border-purple-400/50';
    }
    return 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8';
  };

  return (
    <div
      ref={props.ref}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      class={`${baseClass} ${stateClass()}`}
    >
      {/* Selection check / Drag handle */}
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

      {/* Color dot */}
      <div class="h-3 w-3 shrink-0 rounded-full" style={{ background: props.item.color }} />

      {/* Label */}
      <span class={`text-sm ${props.isSelected ? 'text-purple-200' : 'text-neutral-200'}`}>{props.item.label}</span>

      {/* ID badge */}
      <span class="ml-auto font-mono text-xs text-neutral-500">{props.item.id}</span>
    </div>
  );
}

function DropIndicator(props: { y: number }): JSX.Element {
  return (
    <div
      class="pointer-events-none absolute right-3 left-3 z-10"
      style={{ top: `${props.y}px`, transform: 'translateY(-1px)' }}
    >
      {/* Line */}
      <div class="h-0.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
      {/* Left dot */}
      <div class="absolute -top-1 -left-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
      {/* Right dot */}
      <div class="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
    </div>
  );
}

function OrderDisplay(props: { items: DemoItem[] }): JSX.Element {
  return (
    <div class="flex items-center gap-2">
      <span class="text-xs text-neutral-500">Order:</span>
      <div class="flex gap-1">
        <For each={props.items}>
          {(item) => (
            <span
              class="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white"
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

function SelectionInfo(props: { selected: string[]; items: DemoItem[]; onClear: () => void }): JSX.Element {
  const count = () => props.selected.length;

  return (
    <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <span class="text-xs text-neutral-500">Selection:</span>

      <Show
        when={count() > 0}
        fallback={
          <span class="text-xs text-neutral-500 italic">
            Click items to select · Ctrl+click to multi-select · Shift+click for range
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

function AnimationControls(props: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  duration: number;
  setDuration: (v: number) => void;
  isAnimating: boolean;
}): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      {/* Toggle */}
      <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(e) => props.setEnabled(e.currentTarget.checked)}
          class="accent-blue-500"
        />
        FLIP animation
      </label>

      {/* Duration slider */}
      <label class="flex items-center gap-2 text-xs text-neutral-400">
        Duration
        <input
          type="range"
          min="50"
          max="800"
          step="10"
          value={props.duration}
          onInput={(e) => props.setDuration(Number(e.currentTarget.value))}
          class="h-1 w-24 cursor-pointer accent-blue-500"
          disabled={!props.enabled}
        />
        <span class="w-12 font-mono text-neutral-300">{props.duration}ms</span>
      </label>

      {/* Animating indicator */}
      <Show when={props.isAnimating}>
        <span class="text-xs text-blue-400">⟳ animating…</span>
      </Show>
    </div>
  );
}
