export function SliderInput(props: {
  label: string;
  value: () => number;
  setValue: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div class="flex items-center gap-3 py-2">
      <span class="text-ps-text-muted w-32 flex-shrink-0 text-sm">{props.label}</span>
      <input
        type="range"
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        value={props.value()}
        onInput={(e) => props.setValue(parseFloat(e.currentTarget.value))}
        class="bg-ps-bg-lighter h-1 flex-1 cursor-pointer appearance-none rounded"
      />
      <div class="flex w-20 items-center">
        <input
          type="number"
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          value={props.value()}
          onInput={(e) => props.setValue(parseFloat(e.currentTarget.value) || 0)}
          class="bg-ps-bg-dark border-ps-border text-ps-text w-16 rounded border px-2 py-1 text-right text-sm"
        />
        <span class="text-ps-text-muted ml-1 text-sm">{props.unit ?? '%'}</span>
      </div>
    </div>
  );
}
