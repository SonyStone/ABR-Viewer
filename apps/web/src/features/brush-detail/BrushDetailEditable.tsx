import { ComponentProps, createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import type { BrushWithPreview } from '~/lib/abr';
import { brushTipToPngBlob } from '~/lib/abr';
import { CollapsibleSection } from './components/CollapsibleSection';
import { BrushTipPanel } from './components/panel-components/BrushTipPanel';
import { RawSettingsPanel } from './components/panel-components/RawSettingsPanel';
import { ScatteringPanel } from './components/panel-components/ScatteringPanel';
import { ShapeDynamicsPanel } from './components/panel-components/ShapeDynamicsPanel';
import { TransferPanel } from './components/panel-components/TransferPanel';
import { extractPercent } from './helper-functions/extractPercent';
import { sanitizeFilename } from './helper-functions/sanitizeFilename';

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'brush-detail-editable': ComponentProps<'div'>;
    }
  }
}

export function BrushDetailEditable(props: {
  brush: BrushWithPreview;
  onClose: () => void;
  onSave?: (brush: BrushWithPreview) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const [hasChanges, setHasChanges] = createSignal(false);
  const [downloading, setDownloading] = createSignal(false);
  let scrollContainerRef: HTMLDivElement | undefined;

  // Function to scroll to a section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element && scrollContainerRef) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Editable state - core properties
  const [name, setName] = createSignal(props.brush.name);
  const [spacing, setSpacing] = createSignal(props.brush.spacing ?? 25);
  const [diameter, setDiameter] = createSignal(props.brush.diameter ?? 30);
  const [angle, setAngle] = createSignal(props.brush.angle ?? 0);
  const [roundness, setRoundness] = createSignal(props.brush.roundness ?? 100);
  const [hardness, setHardness] = createSignal(props.brush.hardness ?? 100);
  const [flipX, setFlipX] = createSignal(false);
  const [flipY, setFlipY] = createSignal(false);

  // Feature toggles
  const [useShapeDynamics, setUseShapeDynamics] = createSignal(props.brush.settings?.useTipDynamics === true);
  const [useScattering, setUseScattering] = createSignal(props.brush.settings?.useScatter === true);
  const [useTexture, setUseTexture] = createSignal(props.brush.settings?.useTexture === true);
  const [useDualBrush, setUseDualBrush] = createSignal(false);
  const [useColorDynamics, setUseColorDynamics] = createSignal(props.brush.settings?.useColorDynamics === true);
  const [useTransfer, setUseTransfer] = createSignal(props.brush.settings?.usePaintDynamics === true);
  const [useBrushPose, setUseBrushPose] = createSignal(props.brush.settings?.useBrushPose === true);
  const [useNoise, setUseNoise] = createSignal(props.brush.settings?.useNoise === true);
  const [useWetEdges, setUseWetEdges] = createSignal(props.brush.settings?.Wtdg === true);
  const [useBuildUp, setUseBuildUp] = createSignal(props.brush.settings?.useBuildUp === true);
  const [useSmoothing, setUseSmoothing] = createSignal(props.brush.settings?.useSmoothing === true);
  const [useProtectTexture, setUseProtectTexture] = createSignal(props.brush.settings?.useProtectTexture === true);

  // Shape dynamics state
  const [sizeJitter, setSizeJitter] = createSignal(0);
  const [sizeControl, setSizeControl] = createSignal(0);
  const [sizeMinimum, setSizeMinimum] = createSignal(0);
  const [minimumDiameter, setMinimumDiameter] = createSignal(0);
  const [tiltScale, setTiltScale] = createSignal(100);
  const [angleJitter, setAngleJitter] = createSignal(0);
  const [angleControl, setAngleControl] = createSignal(0);
  const [roundnessJitter, setRoundnessJitter] = createSignal(0);
  const [roundnessControl, setRoundnessControl] = createSignal(0);
  const [roundnessMinimum, setRoundnessMinimum] = createSignal(25);
  const [flipXJitter, setFlipXJitter] = createSignal(false);
  const [flipYJitter, setFlipYJitter] = createSignal(false);
  const [brushProjection, setBrushProjection] = createSignal(false);

  // Scattering state
  const [scatter, setScatter] = createSignal(0);
  const [scatterBothAxes, setScatterBothAxes] = createSignal(false);
  const [scatterControl, setScatterControl] = createSignal(0);
  const [scatterCount, setScatterCount] = createSignal(1);
  const [countJitter, setCountJitter] = createSignal(0);
  const [countControl, setCountControl] = createSignal(0);

  // Transfer state
  const [opacityJitter, setOpacityJitter] = createSignal(0);
  const [opacityControl, setOpacityControl] = createSignal(0);
  const [opacityMinimum, setOpacityMinimum] = createSignal(0);
  const [flowJitter, setFlowJitter] = createSignal(0);
  const [flowControl, setFlowControl] = createSignal(0);
  const [flowMinimum, setFlowMinimum] = createSignal(0);

  // Initialize from brush settings
  createEffect(() => {
    const settings = props.brush.settings || {};
    const brushDef = (settings.Brsh as Record<string, unknown>) || {};

    // Extract flip values
    setFlipX(brushDef.flipX === true);
    setFlipY(brushDef.flipY === true);

    // Extract shape dynamics
    const szVr = settings.szVr as Record<string, unknown>;
    if (szVr) {
      setSizeJitter(extractPercent(szVr.jitter));
      setSizeControl((szVr.bVTy as number) || 0);
      setSizeMinimum(extractPercent(szVr['Mnm '] || szVr.Mnm));
    }
    setMinimumDiameter(extractPercent(settings.minimalDiameter));
    setTiltScale(extractPercent(settings.tiltScale) || 100);

    const angleDynamics = settings.angleDynamics as Record<string, unknown>;
    if (angleDynamics) {
      setAngleJitter(extractPercent(angleDynamics.jitter));
      setAngleControl((angleDynamics.bVTy as number) || 0);
    }

    const roundnessDynamics = settings.roundnessDynamics as Record<string, unknown>;
    if (roundnessDynamics) {
      setRoundnessJitter(extractPercent(roundnessDynamics.jitter));
      setRoundnessControl((roundnessDynamics.bVTy as number) || 0);
      setRoundnessMinimum(extractPercent(roundnessDynamics['Mnm '] || roundnessDynamics.Mnm) || 25);
    }

    setFlipXJitter(settings.flipX === true);
    setFlipYJitter(settings.flipY === true);
    setBrushProjection(settings.brushProjection === true);

    // Extract scattering
    const scatterSettings = settings.scatter as Record<string, unknown>;
    if (scatterSettings) {
      setScatter(extractPercent(scatterSettings.Sctr));
      setScatterBothAxes(scatterSettings.bothAxes === true);
      setScatterControl((scatterSettings.bVTy as number) || 0);
      setScatterCount((scatterSettings['Cnt '] as number) || 1);
    }
    const countDynamics = settings.countDynamics as Record<string, unknown>;
    if (countDynamics) {
      setCountJitter(extractPercent(countDynamics.jitter));
      setCountControl((countDynamics.bVTy as number) || 0);
    }

    // Extract transfer
    const opacityDynamics = settings.opacityDynamics as Record<string, unknown>;
    if (opacityDynamics) {
      setOpacityJitter(extractPercent(opacityDynamics.jitter));
      setOpacityControl((opacityDynamics.bVTy as number) || 0);
      setOpacityMinimum(extractPercent(opacityDynamics['Mnm '] || opacityDynamics.Mnm));
    }
    const flowDynamics = settings.flowDynamics as Record<string, unknown>;
    if (flowDynamics) {
      setFlowJitter(extractPercent(flowDynamics.jitter));
      setFlowControl((flowDynamics.bVTy as number) || 0);
      setFlowMinimum(extractPercent(flowDynamics['Mnm '] || flowDynamics.Mnm));
    }
  });

  // Track changes
  const markChanged = () => setHasChanges(true);

  const panels = createMemo(() => [
    { id: 'brush-tip', label: 'Brush Tip Shape', always: true },
    {
      id: 'shape-dynamics',
      label: 'Shape Dynamics',
      enabled: useShapeDynamics,
      setEnabled: setUseShapeDynamics
    },
    {
      id: 'scattering',
      label: 'Scattering',
      enabled: useScattering,
      setEnabled: setUseScattering
    },
    {
      id: 'texture',
      label: 'Texture',
      enabled: useTexture,
      setEnabled: setUseTexture
    },
    {
      id: 'dual-brush',
      label: 'Dual Brush',
      enabled: useDualBrush,
      setEnabled: setUseDualBrush
    },
    {
      id: 'color-dynamics',
      label: 'Color Dynamics',
      enabled: useColorDynamics,
      setEnabled: setUseColorDynamics
    },
    {
      id: 'transfer',
      label: 'Transfer',
      enabled: useTransfer,
      setEnabled: setUseTransfer
    },
    {
      id: 'brush-pose',
      label: 'Brush Pose',
      enabled: useBrushPose,
      setEnabled: setUseBrushPose
    },
    { id: 'noise', label: 'Noise', enabled: useNoise, setEnabled: setUseNoise },
    {
      id: 'wet-edges',
      label: 'Wet Edges',
      enabled: useWetEdges,
      setEnabled: setUseWetEdges
    },
    {
      id: 'build-up',
      label: 'Build-up',
      enabled: useBuildUp,
      setEnabled: setUseBuildUp
    },
    {
      id: 'smoothing',
      label: 'Smoothing',
      enabled: useSmoothing,
      setEnabled: setUseSmoothing
    },
    {
      id: 'protect-texture',
      label: 'Protect Texture',
      enabled: useProtectTexture,
      setEnabled: setUseProtectTexture
    },
    { id: 'raw', label: 'Raw Settings', always: true }
  ]);

  const handleDownloadImage = async () => {
    if (!props.brush.brushTip) return;
    setDownloading(true);
    try {
      const blob = await brushTipToPngBlob(props.brush.brushTip);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(name())}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = () => {
    if (!props.onSave) return;

    // Start with original settings to preserve all fields
    const updatedSettings = { ...props.brush.settings };

    // Update only the settings that were explicitly changed
    updatedSettings.useTipDynamics = useShapeDynamics();
    updatedSettings.useScatter = useScattering();
    updatedSettings.useTexture = useTexture();
    updatedSettings.useColorDynamics = useColorDynamics();
    updatedSettings.usePaintDynamics = useTransfer();
    updatedSettings.useBrushPose = useBrushPose();
    updatedSettings.useNoise = useNoise();
    updatedSettings.Wtdg = useWetEdges();
    updatedSettings.useBuildUp = useBuildUp();
    updatedSettings.useSmoothing = useSmoothing();
    updatedSettings.useProtectTexture = useProtectTexture();
    updatedSettings.flipX = flipXJitter();
    updatedSettings.flipY = flipYJitter();
    updatedSettings.brushProjection = brushProjection();

    // Shape dynamics - merge with existing or create new
    if (useShapeDynamics()) {
      updatedSettings.szVr = {
        ...((updatedSettings.szVr as Record<string, unknown>) || {}),
        jitter: { unit: '#Prc', value: sizeJitter() },
        bVTy: sizeControl(),
        'Mnm ': { unit: '#Prc', value: sizeMinimum() }
      };
      updatedSettings.angleDynamics = {
        ...((updatedSettings.angleDynamics as Record<string, unknown>) || {}),
        jitter: { unit: '#Ang', value: angleJitter() },
        bVTy: angleControl()
      };
      updatedSettings.roundnessDynamics = {
        ...((updatedSettings.roundnessDynamics as Record<string, unknown>) || {}),
        jitter: { unit: '#Prc', value: roundnessJitter() },
        bVTy: roundnessControl(),
        'Mnm ': { unit: '#Prc', value: roundnessMinimum() }
      };
    }
    updatedSettings.minimumDiameter = {
      unit: '#Prc',
      value: minimumDiameter()
    };
    updatedSettings.tiltScale = { unit: '#Prc', value: tiltScale() };

    // Scattering - merge with existing or create new
    if (useScattering()) {
      updatedSettings.scatter = {
        ...((updatedSettings.scatter as Record<string, unknown>) || {}),
        Sctr: { unit: '#Prc', value: scatter() },
        bothAxes: scatterBothAxes(),
        bVTy: scatterControl(),
        'Cnt ': scatterCount()
      };
      updatedSettings.countDynamics = {
        ...((updatedSettings.countDynamics as Record<string, unknown>) || {}),
        jitter: { unit: '#Prc', value: countJitter() },
        bVTy: countControl()
      };
    }

    // Transfer - merge with existing or create new
    if (useTransfer()) {
      updatedSettings.opacityDynamics = {
        ...((updatedSettings.opacityDynamics as Record<string, unknown>) || {}),
        jitter: { unit: '#Prc', value: opacityJitter() },
        bVTy: opacityControl(),
        'Mnm ': { unit: '#Prc', value: opacityMinimum() }
      };
      updatedSettings.flowDynamics = {
        ...((updatedSettings.flowDynamics as Record<string, unknown>) || {}),
        jitter: { unit: '#Prc', value: flowJitter() },
        bVTy: flowControl(),
        'Mnm ': { unit: '#Prc', value: flowMinimum() }
      };
    }

    const updatedBrush: BrushWithPreview = {
      ...props.brush,
      name: name(),
      spacing: spacing(),
      diameter: diameter(),
      angle: angle(),
      roundness: roundness(),
      hardness: props.brush.type === 'computed' ? hardness() : props.brush.hardness,
      settings: updatedSettings
    };

    props.onSave(updatedBrush);
    setHasChanges(false);
  };

  return (
    <brush-detail-editable
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={props.onClose}
    >
      <div
        class="bg-ps-bg shadow-ps-lg flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="border-ps-border bg-ps-bg-dark flex items-center justify-between border-b p-4">
          <div class="flex items-center gap-3">
            <div class="bg-ps-accent/20 flex h-8 w-8 items-center justify-center rounded">
              <svg class="text-ps-accent h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
            <div>
              <input
                type="text"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value);
                  markChanged();
                }}
                class="text-ps-text-bright hover:border-ps-border focus:border-ps-accent -ml-1 border-b border-transparent bg-transparent px-1 text-lg font-medium focus:outline-none"
              />
              <p class="text-ps-text-muted text-xs">
                {props.brush.type === 'computed' ? 'Computed Brush' : 'Sampled Brush'} • ID: {props.brush.id}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Show when={props.onSave}>
              <button
                onClick={handleSave}
                disabled={!hasChanges()}
                class={`flex items-center gap-2 rounded px-3 py-1.5 text-sm ${
                  hasChanges()
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-ps-bg-light text-ps-text-muted cursor-not-allowed'
                }`}
                title="Save Changes"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Save
              </button>
            </Show>
            <Show when={props.onDuplicate}>
              <button
                onClick={props.onDuplicate}
                class="bg-ps-bg-light hover:bg-ps-bg-lighter text-ps-text rounded p-2 text-sm"
                title="Duplicate Brush"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </Show>
            <Show when={props.onDelete}>
              <button
                onClick={props.onDelete}
                class="rounded bg-red-600/20 p-2 text-sm text-red-400 hover:bg-red-600/30"
                title="Delete Brush"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </Show>
            <button onClick={props.onClose} class="hover:bg-ps-bg-light ml-2 rounded p-2" aria-label="Close">
              <svg class="text-ps-text-muted h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="flex flex-1 overflow-hidden">
          {/* Left Panel - Feature Toggles */}
          <div class="bg-ps-bg-dark border-ps-border w-52 flex-shrink-0 overflow-y-auto border-r">
            <For each={panels()}>
              {(panel) => (
                <button
                  onClick={() => {
                    scrollToSection(panel.id);
                  }}
                  class={`text-ps-text hover:bg-ps-bg-light/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm`}
                >
                  <Show when={!panel.always && panel.setEnabled}>
                    <input
                      type="checkbox"
                      checked={panel.enabled?.()}
                      onChange={(e) => {
                        panel.setEnabled?.(e.currentTarget.checked);
                        markChanged();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      class="border-ps-border bg-ps-bg-dark checked:bg-ps-accent checked:border-ps-accent h-4 w-4 rounded"
                    />
                  </Show>
                  <Show when={panel.always}>
                    <div class="w-4" />
                  </Show>
                  <span class={!panel.always && !panel.enabled?.() ? 'opacity-50' : ''}>{panel.label}</span>
                </button>
              )}
            </For>
          </div>

          {/* Right Panel - Settings Content (All sections as collapsibles) */}
          <div ref={scrollContainerRef} class="flex-1 space-y-2 overflow-y-auto p-4">
            {/* Brush Tip Shape */}
            <CollapsibleSection id="brush-tip" title="Brush Tip Shape" defaultOpen={true}>
              <BrushTipPanel
                brush={props.brush}
                diameter={diameter}
                setDiameter={(v) => {
                  setDiameter(v);
                  markChanged();
                }}
                angle={angle}
                setAngle={(v) => {
                  setAngle(v);
                  markChanged();
                }}
                roundness={roundness}
                setRoundness={(v) => {
                  setRoundness(v);
                  markChanged();
                }}
                hardness={hardness}
                setHardness={(v) => {
                  setHardness(v);
                  markChanged();
                }}
                spacing={spacing}
                setSpacing={(v) => {
                  setSpacing(v);
                  markChanged();
                }}
                flipX={flipX}
                setFlipX={(v) => {
                  setFlipX(v);
                  markChanged();
                }}
                flipY={flipY}
                setFlipY={(v) => {
                  setFlipY(v);
                  markChanged();
                }}
                onDownload={handleDownloadImage}
                downloading={downloading()}
              />
            </CollapsibleSection>

            {/* Shape Dynamics */}
            <CollapsibleSection
              id="shape-dynamics"
              title="Shape Dynamics"
              enabled={useShapeDynamics()}
              defaultOpen={useShapeDynamics()}
              onToggleEnabled={(v) => {
                setUseShapeDynamics(v);
                markChanged();
              }}
            >
              <ShapeDynamicsPanel
                enabled={useShapeDynamics()}
                sizeJitter={sizeJitter}
                setSizeJitter={(v) => {
                  setSizeJitter(v);
                  markChanged();
                }}
                sizeControl={sizeControl}
                setSizeControl={(v) => {
                  setSizeControl(v);
                  markChanged();
                }}
                sizeMinimum={sizeMinimum}
                setSizeMinimum={(v) => {
                  setSizeMinimum(v);
                  markChanged();
                }}
                minimumDiameter={minimumDiameter}
                setMinimumDiameter={(v) => {
                  setMinimumDiameter(v);
                  markChanged();
                }}
                tiltScale={tiltScale}
                setTiltScale={(v) => {
                  setTiltScale(v);
                  markChanged();
                }}
                angleJitter={angleJitter}
                setAngleJitter={(v) => {
                  setAngleJitter(v);
                  markChanged();
                }}
                angleControl={angleControl}
                setAngleControl={(v) => {
                  setAngleControl(v);
                  markChanged();
                }}
                roundnessJitter={roundnessJitter}
                setRoundnessJitter={(v) => {
                  setRoundnessJitter(v);
                  markChanged();
                }}
                roundnessControl={roundnessControl}
                setRoundnessControl={(v) => {
                  setRoundnessControl(v);
                  markChanged();
                }}
                roundnessMinimum={roundnessMinimum}
                setRoundnessMinimum={(v) => {
                  setRoundnessMinimum(v);
                  markChanged();
                }}
                flipXJitter={flipXJitter}
                setFlipXJitter={(v) => {
                  setFlipXJitter(v);
                  markChanged();
                }}
                flipYJitter={flipYJitter}
                setFlipYJitter={(v) => {
                  setFlipYJitter(v);
                  markChanged();
                }}
                brushProjection={brushProjection}
                setBrushProjection={(v) => {
                  setBrushProjection(v);
                  markChanged();
                }}
              />
            </CollapsibleSection>

            {/* Scattering */}
            <CollapsibleSection
              id="scattering"
              title="Scattering"
              enabled={useScattering()}
              defaultOpen={useScattering()}
              onToggleEnabled={(v) => {
                setUseScattering(v);
                markChanged();
              }}
            >
              <ScatteringPanel
                enabled={useScattering()}
                scatter={scatter}
                setScatter={(v) => {
                  setScatter(v);
                  markChanged();
                }}
                bothAxes={scatterBothAxes}
                setBothAxes={(v) => {
                  setScatterBothAxes(v);
                  markChanged();
                }}
                scatterControl={scatterControl}
                setScatterControl={(v) => {
                  setScatterControl(v);
                  markChanged();
                }}
                count={scatterCount}
                setCount={(v) => {
                  setScatterCount(v);
                  markChanged();
                }}
                countJitter={countJitter}
                setCountJitter={(v) => {
                  setCountJitter(v);
                  markChanged();
                }}
                countControl={countControl}
                setCountControl={(v) => {
                  setCountControl(v);
                  markChanged();
                }}
              />
            </CollapsibleSection>

            {/* Texture */}
            <CollapsibleSection
              id="texture"
              title="Texture"
              enabled={useTexture()}
              defaultOpen={useTexture()}
              onToggleEnabled={(v) => {
                setUseTexture(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Texture settings coming soon</div>
            </CollapsibleSection>

            {/* Dual Brush */}
            <CollapsibleSection
              id="dual-brush"
              title="Dual Brush"
              enabled={useDualBrush()}
              defaultOpen={useDualBrush()}
              onToggleEnabled={(v) => {
                setUseDualBrush(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Dual Brush settings coming soon</div>
            </CollapsibleSection>

            {/* Color Dynamics */}
            <CollapsibleSection
              id="color-dynamics"
              title="Color Dynamics"
              enabled={useColorDynamics()}
              defaultOpen={useColorDynamics()}
              onToggleEnabled={(v) => {
                setUseColorDynamics(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Color Dynamics settings coming soon</div>
            </CollapsibleSection>

            {/* Transfer */}
            <CollapsibleSection
              id="transfer"
              title="Transfer"
              enabled={useTransfer()}
              defaultOpen={useTransfer()}
              onToggleEnabled={(v) => {
                setUseTransfer(v);
                markChanged();
              }}
            >
              <TransferPanel
                enabled={useTransfer()}
                opacityJitter={opacityJitter}
                setOpacityJitter={(v) => {
                  setOpacityJitter(v);
                  markChanged();
                }}
                opacityControl={opacityControl}
                setOpacityControl={(v) => {
                  setOpacityControl(v);
                  markChanged();
                }}
                opacityMinimum={opacityMinimum}
                setOpacityMinimum={(v) => {
                  setOpacityMinimum(v);
                  markChanged();
                }}
                flowJitter={flowJitter}
                setFlowJitter={(v) => {
                  setFlowJitter(v);
                  markChanged();
                }}
                flowControl={flowControl}
                setFlowControl={(v) => {
                  setFlowControl(v);
                  markChanged();
                }}
                flowMinimum={flowMinimum}
                setFlowMinimum={(v) => {
                  setFlowMinimum(v);
                  markChanged();
                }}
              />
            </CollapsibleSection>

            {/* Brush Pose */}
            <CollapsibleSection
              id="brush-pose"
              title="Brush Pose"
              enabled={useBrushPose()}
              defaultOpen={useBrushPose()}
              onToggleEnabled={(v) => {
                setUseBrushPose(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Brush Pose settings coming soon</div>
            </CollapsibleSection>

            {/* Noise */}
            <CollapsibleSection
              id="noise"
              title="Noise"
              enabled={useNoise()}
              defaultOpen={useNoise()}
              onToggleEnabled={(v) => {
                setUseNoise(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Noise adds randomness to brush strokes</div>
            </CollapsibleSection>

            {/* Wet Edges */}
            <CollapsibleSection
              id="wet-edges"
              title="Wet Edges"
              enabled={useWetEdges()}
              defaultOpen={useWetEdges()}
              onToggleEnabled={(v) => {
                setUseWetEdges(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Wet Edges creates a watercolor-like effect</div>
            </CollapsibleSection>

            {/* Build-up */}
            <CollapsibleSection
              id="build-up"
              title="Build-up"
              enabled={useBuildUp()}
              defaultOpen={useBuildUp()}
              onToggleEnabled={(v) => {
                setUseBuildUp(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">
                Build-up simulates traditional airbrush techniques
              </div>
            </CollapsibleSection>

            {/* Smoothing */}
            <CollapsibleSection
              id="smoothing"
              title="Smoothing"
              enabled={useSmoothing()}
              defaultOpen={useSmoothing()}
              onToggleEnabled={(v) => {
                setUseSmoothing(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">Smoothing reduces jitter in brush strokes</div>
            </CollapsibleSection>

            {/* Protect Texture */}
            <CollapsibleSection
              id="protect-texture"
              title="Protect Texture"
              enabled={useProtectTexture()}
              defaultOpen={useProtectTexture()}
              onToggleEnabled={(v) => {
                setUseProtectTexture(v);
                markChanged();
              }}
            >
              <div class="text-ps-text-muted py-4 text-center text-sm">
                Protect Texture preserves texture when using preset brushes
              </div>
            </CollapsibleSection>

            {/* Raw Settings */}
            <CollapsibleSection id="raw" title="Raw Settings" defaultOpen={false}>
              <RawSettingsPanel settings={props.brush.settings || {}} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </brush-detail-editable>
  );
}

// Collapsible Section Component
