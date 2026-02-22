import { createBodyCursor } from '@solid-primitives/cursor';
import { throttle } from '@solid-primitives/scheduled';
import { createDragSensor, createFlip, createNestable, Place, Rect, Tree } from 'solid-dnd';
import { createMemo, createSignal, For, Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';

// ============================================================================
// MARK: Types & Data
// ============================================================================

type NodeData = {
  id: string;
  label: string;
  color: string;
  isGroup: boolean;
};

/** Static node definitions — never mutated, identity-stable for <For>. */
const NODES: Record<string, NodeData> = {
  // Groups
  fruits: { id: 'fruits', label: '🍎 Fruits', color: '#e74c3c', isGroup: true },
  veggies: { id: 'veggies', label: '🥕 Vegetables', color: '#2ecc71', isGroup: true },
  grains: { id: 'grains', label: '🌾 Grains', color: '#d4a017', isGroup: true },
  dairy: { id: 'dairy', label: '🧀 Dairy', color: '#f5f5dc', isGroup: true },
  // Fruits
  apple: { id: 'apple', label: 'Apple', color: '#e74c3c', isGroup: false },
  banana: { id: 'banana', label: 'Banana', color: '#f1c40f', isGroup: false },
  cherry: { id: 'cherry', label: 'Cherry', color: '#c0392b', isGroup: false },
  mango: { id: 'mango', label: 'Mango', color: '#ff9933', isGroup: false },
  grape: { id: 'grape', label: 'Grape', color: '#8e44ad', isGroup: false },
  // Vegetables
  carrot: { id: 'carrot', label: 'Carrot', color: '#e67e22', isGroup: false },
  pea: { id: 'pea', label: 'Pea', color: '#27ae60', isGroup: false },
  broccoli: { id: 'broccoli', label: 'Broccoli', color: '#1abc9c', isGroup: false },
  pepper: { id: 'pepper', label: 'Pepper', color: '#e74c3c', isGroup: false },
  // Grains
  rice: { id: 'rice', label: 'Rice', color: '#ecf0f1', isGroup: false },
  oats: { id: 'oats', label: 'Oats', color: '#c8b88a', isGroup: false },
  wheat: { id: 'wheat', label: 'Wheat', color: '#d4a017', isGroup: false },
  // Dairy
  milk: { id: 'milk', label: 'Milk', color: '#f0f0f0', isGroup: false },
  cheese: { id: 'cheese', label: 'Cheese', color: '#f4d03f', isGroup: false },
  yogurt: { id: 'yogurt', label: 'Yogurt', color: '#fadbd8', isGroup: false }
};

/** Tree structure as parentKey → ordered child IDs. */
function createInitialTree(): Record<string, string[]> {
  return {
    root: ['fruits', 'veggies', 'grains', 'dairy'],
    fruits: ['apple', 'banana', 'cherry', 'mango', 'grape'],
    veggies: ['carrot', 'pea', 'broccoli', 'pepper'],
    grains: ['rice', 'oats', 'wheat'],
    dairy: ['milk', 'cheese', 'yogurt']
  };
}

// ============================================================================
// MARK: Nested Demo
// ============================================================================

export default function NestedDemo(): JSX.Element {
  const logger = createEventLogger();

  // ── State ───────────────────────────────────────────────────────────────
  const [tree, setTree] = createSignal(createInitialTree());
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>();
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

  // ── FLIP animation ─────────────────────────────────────────────────────
  const flip = createFlip({ elements: itemRefs as Map<string, HTMLElement> });

  // ── Throttled drop-place update ─────────────────────────────────────────
  const throttledSetDropPlace = throttle((pos: { x: number; y: number }) => {
    setDropPlace(nestable.getInsertionPoint(pos));
  }, 16);

  function resetDragState() {
    throttledSetDropPlace.clear();
    pendingDragId = null;
    setDraggedId(null);
    setDropPlace(undefined);
  }

  // ── Apply drop: move node in the tree ───────────────────────────────────
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
      setDraggedId(id);
      const node = NODES[id];
      const tag = node?.isGroup ? '📁' : '📄';
      logger.addLog(`▶ DRAG  ${tag} "${id}" at (${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})`);
      setDropPlace(nestable.getInsertionPoint(e.position));
    },
    onDragMove: (e) => {
      throttledSetDropPlace(e.position);
    },
    onDragEnd: () => {
      const place = dropPlace();
      const id = draggedId();
      if (place && id) {
        flip.animate(() => applyDrop(id, place), { duration: 200 });
        logger.addLog(`■ DROP  "${id}" → ${Place.label(place)}`);
      }
      resetDragState();
    },
    onDragCancel: () => {
      logger.addLog('✕ CANCEL');
      resetDragState();
    }
  });

  createBodyCursor(() => (sensor.isDragging() ? 'grabbing' : null));

  function handlePointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Indicator position per container ────────────────────────────────────
  function indicatorFor(containerKey: string): number | undefined {
    if (!sensor.isDragging()) return undefined;
    const result = nestable.getIndicatorOffset(dropPlace());
    if (!result || result.containerKey !== containerKey) return undefined;
    return result.offset;
  }

  // ── Recursive rendering ─────────────────────────────────────────────────

  function NodeChildren(props: { parentId: string; depth: number }): JSX.Element {
    return (
      <div ref={(el) => containerRefs.set(props.parentId, el)} class="relative flex flex-col gap-1.5">
        <For each={tree()[props.parentId] ?? []}>
          {(childId) => {
            const node = NODES[childId];
            if (!node) return null;

            if (node.isGroup) {
              return (
                <GroupNode
                  id={childId}
                  node={node}
                  depth={props.depth}
                  isDragged={childId === draggedId() && sensor.isDragging()}
                />
              );
            }

            return <LeafItem id={childId} node={node} isDragged={childId === draggedId() && sensor.isDragging()} />;
          }}
        </For>

        {/* Empty state */}
        <Show when={(tree()[props.parentId] ?? []).length === 0}>
          <div class="py-3 text-center text-xs text-neutral-600 italic">Drop items here</div>
        </Show>

        {/* Drop indicator */}
        <Show when={indicatorFor(props.parentId) !== undefined}>
          <DropIndicator y={indicatorFor(props.parentId)!} />
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
        class={`rounded-lg border border-dashed bg-white/3 ${borderClass()} ${props.isDragged ? 'opacity-40' : ''}`}
      >
        {/* Draggable group header */}
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

        {/* Nested children */}
        <div class="px-2 pb-2">
          <NodeChildren parentId={props.id} depth={props.depth + 1} />
        </div>
      </div>
    );
  }

  function LeafItem(props: { id: string; node: NodeData; isDragged: boolean }): JSX.Element {
    const baseClass =
      'flex cursor-grab touch-none items-center gap-3 rounded-lg border px-3 py-2.5 transition-all select-none';

    const stateClass = () => {
      if (props.isDragged) return 'border-blue-500/30 bg-blue-500/10 opacity-40';
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
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">Nested Containers</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Drag items between groups. Drag groups to reorder or nest them inside other groups. Cycle prevention stops you
          from dropping a group into its own descendant. Combines{' '}
          <code class="rounded bg-white/10 px-1">createDragSensor</code> +{' '}
          <code class="rounded bg-white/10 px-1">createNestable</code> +{' '}
          <code class="rounded bg-white/10 px-1">createFlip</code>.
        </p>
      </div>

      {/* ── Nested tree ──────────────────────────────────────────── */}
      <div class="rounded-xl border border-white/10 bg-white/2 p-3">
        <NodeChildren parentId="root" depth={0} />
      </div>

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
      <TreeDisplay tree={tree()} />

      {/* ── Event log ─────────────────────────────────────────────── */}
      <EventLog logger={logger} />
    </div>
  );
}

// ============================================================================
// MARK: Sub-Components
// ============================================================================

function DropIndicator(props: { y: number }): JSX.Element {
  return (
    <div
      class="pointer-events-none absolute right-3 left-3 z-10"
      style={{ top: `${props.y}px`, transform: 'translateY(-1px)' }}
    >
      <div class="h-0.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50" />
      <div class="absolute -top-1 -left-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
      <div class="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-neutral-900" />
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

function TreeDisplay(props: { tree: Record<string, string[]> }): JSX.Element {
  function renderLevel(parentId: string, indent: number): JSX.Element {
    const kids = props.tree[parentId] ?? [];
    return (
      <For each={kids}>
        {(id) => {
          const node = NODES[id];
          if (!node) return null;
          return (
            <div>
              <div class="flex items-center gap-1.5 py-0.5" style={{ 'padding-left': `${indent * 16}px` }}>
                <span class="text-xs">{node.isGroup ? '📁' : '📄'}</span>
                <div class="h-2 w-2 rounded-full" style={{ background: node.color }} />
                <span class="text-xs text-neutral-400">{node.label}</span>
              </div>
              <Show when={node.isGroup}>{renderLevel(id, indent + 1)}</Show>
            </div>
          );
        }}
      </For>
    );
  }

  return (
    <div class="rounded-lg border border-white/10 bg-white/5 p-3">
      <div class="mb-2 text-xs font-semibold text-neutral-400">Tree Structure</div>
      <div class="font-mono">{renderLevel('root', 0)}</div>
    </div>
  );
}
