import type { SetStoreFunction } from 'solid-js/store';
import type { BrushFormValues, TransferValues } from '../../brush-form-schema';
import { ControlSelect } from '../editable-input-components/ControlSelect';
import { SliderInput } from '../editable-input-components/SliderInput';

export function TransferPanel(props: { values: TransferValues; setValues: SetStoreFunction<BrushFormValues> }) {
  return (
    <div class="space-y-4">
      <div>
        <SliderInput
          label="Opacity Jitter"
          value={() => props.values.opacityJitter}
          setValue={(v: number) => props.setValues('transfer', 'opacityJitter', v)}
        />
        <ControlSelect
          label="Control"
          value={() => props.values.opacityControl}
          setValue={(v: number) => props.setValues('transfer', 'opacityControl', v)}
        />
        <SliderInput
          label="Minimum"
          value={() => props.values.opacityMinimum}
          setValue={(v: number) => props.setValues('transfer', 'opacityMinimum', v)}
        />
      </div>

      <div class="border-ps-border border-t pt-4">
        <SliderInput
          label="Flow Jitter"
          value={() => props.values.flowJitter}
          setValue={(v: number) => props.setValues('transfer', 'flowJitter', v)}
        />
        <ControlSelect
          label="Control"
          value={() => props.values.flowControl}
          setValue={(v: number) => props.setValues('transfer', 'flowControl', v)}
        />
        <SliderInput
          label="Minimum"
          value={() => props.values.flowMinimum}
          setValue={(v: number) => props.setValues('transfer', 'flowMinimum', v)}
        />
      </div>
    </div>
  );
}
