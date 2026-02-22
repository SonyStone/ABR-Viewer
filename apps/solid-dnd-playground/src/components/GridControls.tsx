import { Show, type JSX } from 'solid-js';

export type GridControlsProps = {
  columns: number;
  setColumns: (v: number) => void;
  animEnabled?: boolean;
  setAnimEnabled?: (v: boolean) => void;
  animDuration: number;
  setAnimDuration: (v: number) => void;
  isAnimating: boolean;
  debugEnabled?: boolean;
  setDebugEnabled?: (v: boolean) => void;
};

export function GridControls(props: GridControlsProps): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
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

      <Show when={props.setAnimEnabled !== undefined}>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={props.animEnabled}
            onChange={(e) => props.setAnimEnabled?.(e.currentTarget.checked)}
            class="accent-blue-500"
          />
          FLIP animation
        </label>
      </Show>

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
          disabled={props.animEnabled === false}
        />
        <span class="w-12 font-mono text-neutral-300">{props.animDuration}ms</span>
      </label>

      <Show when={props.setDebugEnabled !== undefined}>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={props.debugEnabled}
            onChange={(e) => props.setDebugEnabled?.(e.currentTarget.checked)}
            class="accent-yellow-500"
          />
          FLIP debug
        </label>
      </Show>

      <Show when={props.isAnimating}>
        <span class="text-xs text-blue-400">⟳ animating…</span>
      </Show>
    </div>
  );
}
