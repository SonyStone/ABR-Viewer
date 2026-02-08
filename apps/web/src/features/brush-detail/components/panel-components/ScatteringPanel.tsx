import type { SetStoreFunction } from 'solid-js/store';
import type { BrushFormValues, ScatteringValues } from '../../brush-form-schema';
import { CheckboxInput } from '../editable-input-components/CheckboxInput';
import { ControlSelect } from '../editable-input-components/ControlSelect';
import { SliderInput } from '../editable-input-components/SliderInput';

export function ScatteringPanel(props: { values: ScatteringValues; setValues: SetStoreFunction<BrushFormValues> }) {
  return (
    <div class="space-y-4">
      <div>
        <SliderInput
          label="Scatter"
          value={() => props.values.scatter}
          setValue={(v: number) => props.setValues('scattering', 'scatter', v)}
          max={1000}
        />
        <CheckboxInput
          label="Both Axes"
          checked={() => props.values.bothAxes}
          setChecked={(v: boolean) => props.setValues('scattering', 'bothAxes', v)}
        />
        <ControlSelect
          label="Control"
          value={() => props.values.scatterControl}
          setValue={(v: number) => props.setValues('scattering', 'scatterControl', v)}
        />
      </div>

      <div class="border-ps-border border-t pt-4">
        <SliderInput
          label="Count"
          value={() => props.values.count}
          setValue={(v: number) => props.setValues('scattering', 'count', v)}
          min={1}
          max={16}
          unit=""
        />
        <SliderInput
          label="Count Jitter"
          value={() => props.values.countJitter}
          setValue={(v: number) => props.setValues('scattering', 'countJitter', v)}
        />
        <ControlSelect
          label="Control"
          value={() => props.values.countControl}
          setValue={(v: number) => props.setValues('scattering', 'countControl', v)}
        />
      </div>
    </div>
  );
}
