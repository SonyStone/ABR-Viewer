import { CheckboxInput } from '../editable-input-components/CheckboxInput';
import { ControlSelect } from '../editable-input-components/ControlSelect';
import { SliderInput } from '../editable-input-components/SliderInput';

export function ScatteringPanel(props: {
  enabled: boolean;
  scatter: () => number;
  setScatter: (v: number) => void;
  bothAxes: () => boolean;
  setBothAxes: (v: boolean) => void;
  scatterControl: () => number;
  setScatterControl: (v: number) => void;
  count: () => number;
  setCount: (v: number) => void;
  countJitter: () => number;
  setCountJitter: (v: number) => void;
  countControl: () => number;
  setCountControl: (v: number) => void;
}) {
  return (
    <div class="space-y-4">
      <div>
        <SliderInput label="Scatter" value={props.scatter} setValue={props.setScatter} max={1000} />
        <CheckboxInput label="Both Axes" checked={props.bothAxes} setChecked={props.setBothAxes} />
        <ControlSelect label="Control" value={props.scatterControl} setValue={props.setScatterControl} />
      </div>

      <div class="border-ps-border border-t pt-4">
        <SliderInput label="Count" value={props.count} setValue={props.setCount} min={1} max={16} unit="" />
        <SliderInput label="Count Jitter" value={props.countJitter} setValue={props.setCountJitter} />
        <ControlSelect label="Control" value={props.countControl} setValue={props.setCountControl} />
      </div>
    </div>
  );
}
