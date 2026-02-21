import { For, type JSX } from 'solid-js';
import { createDemoItems } from '../data';

// ============================================================================
// MARK: Grid Demo
// ============================================================================

export default function GridDemo(): JSX.Element {
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
