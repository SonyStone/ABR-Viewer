import { Show } from 'solid-js';
import { BrushWithPreview } from '~/lib/abr';
import { CheckboxInput } from '../editable-input-components/CheckboxInput';
import { SliderInput } from '../editable-input-components/SliderInput';

export function BrushTipPanel(props: {
  brush: BrushWithPreview;
  diameter: () => number;
  setDiameter: (v: number) => void;
  angle: () => number;
  setAngle: (v: number) => void;
  roundness: () => number;
  setRoundness: (v: number) => void;
  hardness: () => number;
  setHardness: (v: number) => void;
  spacing: () => number;
  setSpacing: (v: number) => void;
  flipX: () => boolean;
  setFlipX: (v: boolean) => void;
  flipY: () => boolean;
  setFlipY: (v: boolean) => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div class="grid gap-6 md:grid-cols-2">
      {/* Preview */}
      <div class="space-y-4">
        <div class="checkered-bg relative mx-auto aspect-square max-w-64 overflow-hidden rounded-lg">
          <Show
            when={props.brush.imageDataUrl}
            fallback={
              <div class="absolute inset-0 flex items-center justify-center">
                <p class="text-ps-text-muted text-sm">
                  {props.brush.type === 'computed' ? 'Computed brush' : 'No preview'}
                </p>
              </div>
            }
          >
            <img
              src={props.brush.imageDataUrl}
              alt={props.brush.name}
              class="absolute inset-0 h-full w-full object-contain p-2"
              style={{
                transform: `rotate(${props.angle()}deg) scaleX(${props.flipX() ? -1 : 1}) scaleY(${props.flipY() ? -1 : 1})`
              }}
            />
          </Show>
        </div>

        <Show when={props.brush.brushTip}>
          <button
            onClick={props.onDownload}
            disabled={props.downloading}
            class="bg-ps-accent hover:bg-ps-accent-hover w-full rounded px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {props.downloading ? 'Downloading...' : 'Download PNG'}
          </button>
        </Show>
      </div>

      {/* Settings */}
      <div class="space-y-1">
        <SliderInput label="Size" value={props.diameter} setValue={props.setDiameter} min={1} max={2500} unit=" px" />

        <div class="ml-8 flex items-center gap-4 py-2">
          <CheckboxInput label="Flip X" checked={props.flipX} setChecked={props.setFlipX} />
          <CheckboxInput label="Flip Y" checked={props.flipY} setChecked={props.setFlipY} />
        </div>

        <SliderInput label="Angle" value={props.angle} setValue={props.setAngle} min={-180} max={180} unit="°" />

        <SliderInput
          label="Roundness"
          value={props.roundness}
          setValue={props.setRoundness}
          min={0}
          max={100}
          unit="%"
        />

        <Show when={props.brush.type === 'computed'}>
          <SliderInput
            label="Hardness"
            value={props.hardness}
            setValue={props.setHardness}
            min={0}
            max={100}
            unit="%"
          />
        </Show>

        <div class="border-ps-border mt-4 border-t pt-4">
          <SliderInput label="Spacing" value={props.spacing} setValue={props.setSpacing} min={1} max={1000} unit="%" />
        </div>
      </div>
    </div>
  );
}
