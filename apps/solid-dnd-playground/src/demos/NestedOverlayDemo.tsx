import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import {
  createDragOverlay,
  createDragSensor,
  createFlip,
  createNestable,
  createTreeDropzone,
  GAP_KEY,
  Place,
  Rect,
  Tree,
  Vec2
} from 'solid-dnd';
import { createEffect, createMemo, createSignal, For, on, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';
import { StateCard } from '../components/StateCard';
import { TreeDisplay } from '../components/TreeDisplay';
import { createInitialTree, NODES, type NodeData } from '../data';

// ============================================================================
// MARK: Nested Overlay Demo
// ============================================================================

export default function NestedOverlayDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── State ───────────────────────────────────────────────────────────────
  const [tree, setTree] = createSignal(createInitialTree());
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>();
  const [gapHeight, setGapHeight] = createSignal(0);
  let pendingDragId: string | null = null;

  // ── Element refs ────────────────────────────────────────────────────────
  const itemRefs = new Map<string, HTMLDivElement>();
  const containerRefs = new Map<string, HTMLDivElement>();

  // ── Derived: parent lookup ──────────────────────────────────────────────
  const parents = createMemo(() => Tree.parentMap(tree()));
  const getParent = (key: string): string | undefined => parents().get(key);

  // ── Build NestableContainers from tree ──────────────────────────────────
  const containers = createMemo(() =>
    Tree.buildContainers(tree(), {
      isContainer: (id) => NODES[id]?.isGroup ?? false,
      getItemRect: (key) => Rect.fromElement(itemRefs.get(key)),
      getContainerRect: (key) => Rect.fromElement(containerRefs.get(key))
    })
  );

  // ── Nestable primitive ──────────────────────────────────────────────────
  const nestable = createNestable<string>({
    containers,
    dragTags: () => undefined,
    draggedKeys: () => {
      const id = draggedId();
      return id ? [id] : [];
    },
    getParent
  });

  // ── Tree dropzone (live gap) ────────────────────────────────────────────
  const dropzone = createTreeDropzone<string>({
    tree,
    draggedKeys: () => {
      const id = draggedId();
      return id ? [id] : [];
    },
    place: dropPlace
  });

  // ── FLIP animation ─────────────────────────────────────────────────────
  const flip = createFlip({ elements: itemRefs as Map<string, HTMLElement> });

  // ── Drag overlay ────────────────────────────────────────────────────────
  const overlay = createDragOverlay({
    currentPosition: () => sensor.position() ?? Vec2.Zero
  });

  // ── Throttled drop-place update ─────────────────────────────────────────
  const throttledSetDropPlace = throttle((pos: { x: number; y: number }) => {
    setDropPlace(nestable.getInsertionPoint(pos));
  }, 16);

  // ── Animate display key changes during drag ─────────────────────────────
  createEffect(
    on(
      () => {
        // Access all display lists to trigger on any change
        const place = dropPlace();
        if (!place) return null;
        return dropzone.getDisplayKeys(place.parent as any);
      },
      () => {
        if (sensor.isDragging()) {
          flip.playFromFirst();
        }
      },
      { defer: true }
    )
  );

  function resetDragState() {
    throttledSetDropPlace.clear();
    pendingDragId = null;
    setDraggedId(null);
    setDropPlace(undefined);
    setGapHeight(0);
    overlay.stop();
  }

  function applyDrop(id: string, place: Place.Place<string>) {
    setTree((prev) => Tree.move(prev, id, place));
  }

  // ── Drag sensor ─────────────────────────────────────────────────────────
  const sensor = createDragSensor({
    threshold: 5,
    onClick: () => {
      pendingDragId = null;
    },
    onDragStart: (e) => {
      const id = pendingDragId;
      if (!id) return;

      // 1. Measure source element BEFORE any state changes
      const sourceEl = itemRefs.get(id);
      if (sourceEl) {
        setGapHeight(sourceEl.getBoundingClientRect().height);
        overlay.start(sourceEl, e.position);
      }

      // 2. Capture FLIP positions before DOM changes
      flip.captureFirst();

      // 3. Set drag state
      setDraggedId(id);

      const node = NODES[id];
      const tag = node?.isGroup ? '📁' : '📄';
      logger.addLog(`▶ DRAG  ${tag} "${id}" at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
      setDropPlace(nestable.getInsertionPoint(e.position));
    },
    onDragMove: (e) => {
      flip.captureFirst();
      throttledSetDropPlace(e.position);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const id = draggedId();
      if (place && id) {
        const doApply = () => {
          applyDrop(id, place);
          resetDragState();
        };
        flip.animate(doApply, { duration: 200 });
        logger.addLog(`■ DROP  "${id}" → ${Place.label(place)}`);
      } else {
        flip.animate(() => resetDragState(), { duration: 200 });
      }
    },
    onDragCancel: () => {
      logger.addLog('✕ CANCEL');
      flip.animate(() => resetDragState(), { duration: 200 });
    }
  });

  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  function handlePointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Recursive rendering using display keys ──────────────────────────────

  function NodeChildren(props: { parentId: string; depth: number }): JSX.Element {
    const displayKeys = () => dropzone.getDisplayKeys(props.parentId as any);

    return (
      <div ref={(el) => containerRefs.set(props.parentId, el)} class="relative flex flex-col gap-1.5">
        <For each={displayKeys()}>
          {(key) => {
            if (key === GAP_KEY) {
              return (
                <div
                  ref={(el) => itemRefs.set(`__gap_${props.parentId}__`, el)}
                  class="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5"
                  style={{ height: `${gapHeight()}px` }}
                />
              );
            }

            const node = NODES[key];
            if (!node) return null;
            const isDragged = () => dropzone.isDragged(key) && sensor.isDragging();

            if (node.isGroup) {
              return <GroupNode id={key} node={node} depth={props.depth} isDragged={isDragged()} />;
            }

            return <LeafItem id={key} node={node} isDragged={isDragged()} />;
          }}
        </For>

        {/* Empty state */}
        <Show when={displayKeys().filter((k) => k !== GAP_KEY).length === 0}>
          <div class="py-3 text-center text-xs text-neutral-600 italic">Drop items here</div>
        </Show>
      </div>
    );
  }

  function GroupNode(props: { id: string; node: NodeData; depth: number; isDragged: boolean }): JSX.Element {
    const depthColors = ['border-white/15', 'border-white/10', 'border-white/5'];
    const borderClass = () => depthColors[Math.min(props.depth, depthColors.length - 1)];

    return (
      <div
        ref={(el) => itemRefs.set(props.id, el)}
        class={`rounded-lg border border-dashed bg-white/3 ${borderClass()} ${props.isDragged ? '!m-0 !h-0 overflow-hidden !border-0 !p-0 opacity-0' : ''}`}
      >
        <div
          onPointerDown={(ev) => handlePointerDown(props.id, ev)}
          class="flex cursor-grab touch-none items-center gap-2 rounded-t-lg px-3 py-2 select-none hover:bg-white/5"
        >
          <svg class="h-3.5 w-3.5 shrink-0 text-neutral-500" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.2" />
            <circle cx="11" cy="3" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="13" r="1.2" />
            <circle cx="11" cy="13" r="1.2" />
          </svg>
          <div class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: props.node.color }} />
          <span class="text-xs font-semibold text-neutral-400">{props.node.label}</span>
          <span class="ml-auto font-mono text-xs text-neutral-600">{props.id}</span>
        </div>
        <div class="px-2 pb-2">
          <NodeChildren parentId={props.id} depth={props.depth + 1} />
        </div>
      </div>
    );
  }

  function LeafItem(props: { id: string; node: NodeData; isDragged: boolean }): JSX.Element {
    const baseClass = 'flex cursor-grab touch-none items-center gap-3 rounded-lg border px-3 py-2.5 select-none';

    const stateClass = () => {
      if (props.isDragged) return 'border-transparent bg-transparent opacity-0 !h-0 overflow-hidden !py-0 !my-0';
      return 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8';
    };

    return (
      <div
        ref={(el) => itemRefs.set(props.id, el)}
        onPointerDown={(ev) => handlePointerDown(props.id, ev)}
        class={`${baseClass} ${stateClass()}`}
      >
        <svg class="h-3.5 w-3.5 shrink-0 text-neutral-500" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.2" />
          <circle cx="11" cy="3" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="13" r="1.2" />
          <circle cx="11" cy="13" r="1.2" />
        </svg>
        <div class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: props.node.color }} />
        <span class="text-sm text-neutral-200">{props.node.label}</span>
        <span class="ml-auto font-mono text-xs text-neutral-500">{props.id}</span>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div class="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Nested Containers — Drag Overlay</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Items pop out as a floating overlay. A gap opens at the drop position across all containers. Combines{' '}
          <code class="rounded bg-white/10 px-1">createTreeDropzone</code> +{' '}
          <code class="rounded bg-white/10 px-1">createDragOverlay</code> +{' '}
          <code class="rounded bg-white/10 px-1">createNestable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createFlip</code>.
        </p>
      </div>

      {/* ── Nested tree ──────────────────────────────────────────── */}
      <div class="rounded-xl border border-white/10 bg-white/2 p-3">
        <NodeChildren parentId="root" depth={0} />
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
          <NestedOverlayItem draggedId={draggedId()} />
        </div>
      </Show>

      {/* ── Controls ──────────────────────────────────────────────── */}
      <button
        onClick={() => setTree(createInitialTree())}
        class="self-start rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
      >
        ↺ Reset tree
      </button>

      {/* ── State readout ─────────────────────────────────────────── */}
      <div class="grid grid-cols-3 gap-3">
        <StateCard label="isDragging" value={sensor.isDragging() ? 'true' : 'false'} active={sensor.isDragging()} />
        <StateCard label="dragging" value={draggedId() ?? 'none'} active={draggedId() !== null} />
        <StateCard label="dropPlace" value={Place.label(dropPlace())} active={dropPlace() !== undefined} />
      </div>

      {/* ── Tree structure readout ────────────────────────────────── */}
      <TreeDisplay tree={tree()} nodes={NODES} />

      <EventLog logger={logger} />
    </div>
  );
}

// ============================================================================
// MARK: Sub-Components
// ============================================================================

function NestedOverlayItem(props: { draggedId: string | null }): JSX.Element {
  const node = () => (props.draggedId ? NODES[props.draggedId] : undefined);

  return (
    <Show when={node()}>
      {(n) => (
        <div
          class={`flex items-center gap-3 rounded-lg border border-blue-500/50 bg-neutral-800 shadow-xl shadow-blue-500/10 ${n().isGroup ? 'px-3 py-2' : 'px-3 py-2.5'}`}
        >
          <svg class="h-3.5 w-3.5 shrink-0 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.2" />
            <circle cx="11" cy="3" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="13" r="1.2" />
            <circle cx="11" cy="13" r="1.2" />
          </svg>
          <div class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: n().color }} />
          <span class={`text-sm text-neutral-200 ${n().isGroup ? 'text-xs font-semibold' : ''}`}>{n().label}</span>
          <span class="ml-auto font-mono text-xs text-neutral-500">{n().id}</span>
        </div>
      )}
    </Show>
  );
}
