import { For, type JSX } from 'solid-js';
import { createDemoItems } from '../data';

// ============================================================================
// MARK: List Demo
// ============================================================================

export default function ListDemo(): JSX.Element {
  const items = createDemoItems();

  return (
    <div>
      <h2 class="mb-4 text-sm font-semibold text-neutral-300">Sortable List</h2>
      <p class="mb-4 text-xs text-neutral-500">🚧 Will be wired in M2 (createSortable) — this is the static layout.</p>
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
