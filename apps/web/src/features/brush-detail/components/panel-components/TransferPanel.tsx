import { ControlSelect } from '../editable-input-components/ControlSelect';
import { SliderInput } from '../editable-input-components/SliderInput';

export function TransferPanel(props: {
  enabled: boolean;
  opacityJitter: () => number;
  setOpacityJitter: (v: number) => void;
  opacityControl: () => number;
  setOpacityControl: (v: number) => void;
  opacityMinimum: () => number;
  setOpacityMinimum: (v: number) => void;
  flowJitter: () => number;
  setFlowJitter: (v: number) => void;
  flowControl: () => number;
  setFlowControl: (v: number) => void;
  flowMinimum: () => number;
  setFlowMinimum: (v: number) => void;
}) {
  return (
    <div class="space-y-4">
      <div>
        <SliderInput label="Opacity Jitter" value={props.opacityJitter} setValue={props.setOpacityJitter} />
        <ControlSelect label="Control" value={props.opacityControl} setValue={props.setOpacityControl} />
        <SliderInput label="Minimum" value={props.opacityMinimum} setValue={props.setOpacityMinimum} />
      </div>

      <div class="border-ps-border border-t pt-4">
        <SliderInput label="Flow Jitter" value={props.flowJitter} setValue={props.setFlowJitter} />
        <ControlSelect label="Control" value={props.flowControl} setValue={props.setFlowControl} />
        <SliderInput label="Minimum" value={props.flowMinimum} setValue={props.setFlowMinimum} />
      </div>
    </div>
  );
}
