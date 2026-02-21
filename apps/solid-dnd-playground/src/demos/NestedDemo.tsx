import type { JSX } from 'solid-js';

// ============================================================================
// MARK: Nested Demo
// ============================================================================

export default function NestedDemo(): JSX.Element {
  return (
    <div>
      <h2 class="mb-4 text-sm font-semibold text-neutral-300">Nested Containers</h2>
      <p class="mb-4 text-xs text-neutral-500">🚧 Future milestone — nested containers with drag between levels.</p>
      <div class="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <div class="rounded bg-white/5 px-3 py-2 text-sm text-neutral-300">Item A</div>
        <div class="rounded border border-dashed border-white/10 bg-white/2 p-3">
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
