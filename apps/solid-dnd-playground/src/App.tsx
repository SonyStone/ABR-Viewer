import { useLocation } from '@solidjs/router';
import { For, type JSX } from 'solid-js';

// ============================================================================
// MARK: Demo Data
// ============================================================================

type DemoItem = {
  id: string;
  label: string;
  color: string;
};

function createDemoItems(): DemoItem[] {
  return [
    { id: '1', label: 'Item 1', color: '#e74c3c' },
    { id: '2', label: 'Item 2', color: '#3498db' },
    { id: '3', label: 'Item 3', color: '#2ecc71' },
    { id: '4', label: 'Item 4', color: '#f39c12' },
    { id: '5', label: 'Item 5', color: '#9b59b6' },
    { id: '6', label: 'Item 6', color: '#1abc9c' },
    { id: '7', label: 'Item 7', color: '#e67e22' },
    { id: '8', label: 'Item 8', color: '#2980b9' }
  ];
}

// ============================================================================
// MARK: App (root layout)
// ============================================================================

export default function App(props: { children?: JSX.Element }): JSX.Element {
  return (
    <div class="flex h-screen flex-col">
      {/* Header */}
      <header class="flex items-center gap-4 border-b border-white/10 bg-white/5 px-6 py-3">
        <h1 class="text-lg font-bold text-white">solid-dnd Playground</h1>
        <span class="text-xs text-neutral-500">v0.1.0 — Building blocks</span>

        {/* Demo selector */}
        <nav class="ml-auto flex gap-2">
          <DemoTab label="List" href="/" matchAlso="/list" />
          <DemoTab label="Grid" href="/grid" />
          <DemoTab label="Nested" href="/nested" />
        </nav>
      </header>

      {/* Content */}
      <main class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-2xl">{props.children}</div>
      </main>

      {/* Footer */}
      <footer class="border-t border-white/10 bg-white/5 px-6 py-2 text-center text-xs text-neutral-500">
        solid-dnd — Composable drag-and-drop primitives for SolidJS
      </footer>
    </div>
  );
}

// ============================================================================
// MARK: Demo Tab
// ============================================================================

function DemoTab(props: { label: string; href: string; matchAlso?: string }): JSX.Element {
  const location = useLocation();
  const isActive = () => location.pathname === props.href || location.pathname === props.matchAlso;

  return (
    <a
      href={props.href}
      class={`rounded px-3 py-1 text-xs transition-colors ${
        isActive() ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {props.label}
    </a>
  );
}

// ============================================================================
// MARK: List Demo — Milestone 1 target
// ============================================================================

export function ListDemo(): JSX.Element {
  const items = createDemoItems();

  return (
    <div>
      <h2 class="mb-4 text-sm font-semibold text-neutral-300">Sortable List</h2>
      <p class="mb-4 text-xs text-neutral-500">
        🚧 Drag-and-drop not wired yet — this is the static layout that will become interactive.
      </p>
      <div class="flex flex-col gap-2">
        <For each={items}>
          {(item) => (
            <div class="flex cursor-grab items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 active:cursor-grabbing">
              <div class="h-3 w-3 rounded-full" style={{ background: item.color }} />
              <span class="text-sm text-neutral-200">{item.label}</span>
              <span class="ml-auto font-mono text-xs text-neutral-500">{item.id}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ============================================================================
// MARK: Grid Demo — Milestone 6 target
// ============================================================================

export function GridDemo(): JSX.Element {
  const items = createDemoItems();

  return (
    <div>
      <h2 class="mb-4 text-sm font-semibold text-neutral-300">Sortable Grid</h2>
      <p class="mb-4 text-xs text-neutral-500">🚧 Future milestone — grid layout with drag-and-drop.</p>
      <div class="grid grid-cols-4 gap-2">
        <For each={items}>
          {(item) => (
            <div class="flex cursor-grab flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 active:cursor-grabbing">
              <div class="h-8 w-8 rounded" style={{ background: item.color }} />
              <span class="text-xs text-neutral-300">{item.label}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// ============================================================================
// MARK: Nested Demo — Milestone 5 target
// ============================================================================

export function NestedDemo(): JSX.Element {
  return (
    <div>
      <h2 class="mb-4 text-sm font-semibold text-neutral-300">Nested Containers</h2>
      <p class="mb-4 text-xs text-neutral-500">🚧 Future milestone — nested containers with drag between levels.</p>
      <div class="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <div class="rounded bg-white/5 px-3 py-2 text-sm text-neutral-300">Item A</div>
        <div class="rounded border border-dashed border-white/10 bg-white/[0.02] p-3">
          <div class="mb-2 text-xs font-medium text-neutral-400">Group 1</div>
          <div class="flex flex-col gap-1">
            <div class="rounded bg-white/5 px-3 py-2 text-sm text-neutral-300">Item B</div>
            <div class="rounded bg-white/5 px-3 py-2 text-sm text-neutral-300">Item C</div>
          </div>
        </div>
        <div class="rounded bg-white/5 px-3 py-2 text-sm text-neutral-300">Item D</div>
      </div>
    </div>
  );
}
