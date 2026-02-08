import { CheckboxInput } from '../editable-input-components/CheckboxInput';
import { ControlSelect } from '../editable-input-components/ControlSelect';
import { SliderInput } from '../editable-input-components/SliderInput';

export function ShapeDynamicsPanel(props: {
  enabled: boolean;
  sizeJitter: () => number;
  setSizeJitter: (v: number) => void;
  sizeControl: () => number;
  setSizeControl: (v: number) => void;
  sizeMinimum: () => number;
  setSizeMinimum: (v: number) => void;
  minimumDiameter: () => number;
  setMinimumDiameter: (v: number) => void;
  tiltScale: () => number;
  setTiltScale: (v: number) => void;
  angleJitter: () => number;
  setAngleJitter: (v: number) => void;
  angleControl: () => number;
  setAngleControl: (v: number) => void;
  roundnessJitter: () => number;
  setRoundnessJitter: (v: number) => void;
  roundnessControl: () => number;
  setRoundnessControl: (v: number) => void;
  roundnessMinimum: () => number;
  setRoundnessMinimum: (v: number) => void;
  flipXJitter: () => boolean;
  setFlipXJitter: (v: boolean) => void;
  flipYJitter: () => boolean;
  setFlipYJitter: (v: boolean) => void;
  brushProjection: () => boolean;
  setBrushProjection: (v: boolean) => void;
}) {
  return (
    <div class="space-y-4">
      <div>
        <SliderInput label="Size Jitter" value={props.sizeJitter} setValue={props.setSizeJitter} />
        <ControlSelect label="Control" value={props.sizeControl} setValue={props.setSizeControl} />
        <SliderInput label="Minimum" value={props.sizeMinimum} setValue={props.setSizeMinimum} />
      </div>

      <SliderInput label="Minimum Diameter" value={props.minimumDiameter} setValue={props.setMinimumDiameter} />
      <SliderInput label="Tilt Scale" value={props.tiltScale} setValue={props.setTiltScale} max={200} />

      <div class="border-ps-border border-t pt-4">
        <SliderInput
          label="Angle Jitter"
          value={props.angleJitter}
          setValue={props.setAngleJitter}
          unit="°"
          max={360}
        />
        <ControlSelect label="Control" value={props.angleControl} setValue={props.setAngleControl} />
      </div>

      <div class="border-ps-border border-t pt-4">
        <SliderInput label="Roundness Jitter" value={props.roundnessJitter} setValue={props.setRoundnessJitter} />
        <ControlSelect label="Control" value={props.roundnessControl} setValue={props.setRoundnessControl} />
        <SliderInput label="Minimum" value={props.roundnessMinimum} setValue={props.setRoundnessMinimum} />
      </div>

      <div class="border-ps-border flex items-center gap-6 border-t pt-4">
        <CheckboxInput label="Flip X Jitter" checked={props.flipXJitter} setChecked={props.setFlipXJitter} />
        <CheckboxInput label="Flip Y Jitter" checked={props.flipYJitter} setChecked={props.setFlipYJitter} />
      </div>

      <CheckboxInput label="Brush Projection" checked={props.brushProjection} setChecked={props.setBrushProjection} />
    </div>
  );
}
