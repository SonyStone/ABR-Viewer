import type { Vec2 } from 'solid-dnd';
import { createDragSensor } from 'solid-dnd';
import { Show, type JSX } from 'solid-js';
import EventLog, { createEventLogger } from '../components/EventLog';

// ============================================================================
// MARK: Sensor Demo
// ============================================================================

export default function SensorDemo(): JSX.Element {
  const logger = createEventLogger();

  const sensor = createDragSensor({
    threshold: 8,
    onDragStart: (e) =>
      logger.addLog(
        `▶ START  origin=(${e.origin.x.toFixed(0)}, ${e.origin.y.toFixed(0)})  pos=(${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})  pointer=${e.pointerEvent.pointerType}`
      ),
    onDragMove: (e) =>
      logger.addLog(
        `→ MOVE   pos=(${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})  Δ=(${e.delta.x.toFixed(0)}, ${e.delta.y.toFixed(0)})`
      ),
    onDragEnd: (e) =>
      logger.addLog(
        `■ END    pos=(${e.position.x.toFixed(0)}, ${e.position.y.toFixed(0)})  Δ=(${e.delta.x.toFixed(0)}, ${e.delta.y.toFixed(0)})`
      ),
    onDragCancel: () => logger.addLog('✕ CANCEL')
  });

  return (
    <div class="flex flex-col gap-6">
      <div>
        <h2 class="mb-1 text-sm font-semibold text-neutral-300">createDragSensor</h2>
        <p class="mb-4 text-xs text-neutral-500">
          Grab the box and drag it around. The sensor tracks pointer movement, applies an 8px threshold, and reports
          events. Press <kbd class="rounded bg-white/10 px-1">Esc</kbd> to cancel.
        </p>
      </div>

      {/* ── Drag area ────────────────────────────────────────────────── */}
      <div class="relative h-80 overflow-hidden rounded-xl border border-white/10 bg-white/2">
        <div
          onPointerDown={sensor.onPointerDown}
          class={`absolute flex h-20 w-20 cursor-grab touch-none items-center justify-center rounded-xl border text-xs font-bold transition-shadow select-none ${
            sensor.isDragging()
              ? 'z-10 cursor-grabbing border-blue-400 bg-blue-600/30 shadow-lg shadow-blue-500/20'
              : 'border-white/20 bg-white/10 hover:border-white/30'
          }`}
          style={{
            transform: `translate(${sensor.delta()?.x ?? 0}px, ${sensor.delta()?.y ?? 0}px)`,
            left: `140px`,
            top: `120px`
          }}
        >
          <Show when={sensor.isDragging()} fallback="Grab me">
            Dragging!
          </Show>
        </div>
      </div>

      {/* ── Screen-space debug overlay ────────────────────────────── */}
      <DebugOverlay position={sensor.position()} isDragging={sensor.isDragging()} />

      {/* ── State readout ─────────────────────────────────────────── */}
      <div class="grid grid-cols-3 gap-3">
        <StateCard label="isDragging" value={sensor.isDragging() ? 'true' : 'false'} active={sensor.isDragging()} />
        <StateCard
          label="position"
          value={sensor.position() ? `${sensor.position()!.x.toFixed(0)}, ${sensor.position()!.y.toFixed(0)}` : 'null'}
        />
        <StateCard
          label="delta"
          value={sensor.delta() ? `${sensor.delta()!.x.toFixed(0)}, ${sensor.delta()!.y.toFixed(0)}` : 'null'}
        />
      </div>

      {/* ── Event log ─────────────────────────────────────────────── */}
      <EventLog logger={logger} />
    </div>
  );
}

// ============================================================================
// MARK: Sub-components
// ============================================================================

function StateCard(props: { label: string; value: string; active?: boolean }): JSX.Element {
  return (
    <div
      class={`rounded-lg border p-3 ${
        props.active ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/5'
      }`}
    >
      <div class="mb-1 text-xs text-neutral-500">{props.label}</div>
      <div class={`font-mono text-sm ${props.active ? 'text-blue-300' : 'text-neutral-300'}`}>{props.value}</div>
    </div>
  );
}

function DebugOverlay(props: { position: Vec2 | null; isDragging: boolean }): JSX.Element {
  return (
    <Show when={props.isDragging && props.position}>
      {(pos) => (
        <svg class="pointer-events-none fixed inset-0 z-9999" style={{ width: '100vw', height: '100vh' }}>
          <line
            x1={pos().x}
            y1={pos().y - 14}
            x2={pos().x}
            y2={pos().y + 14}
            stroke="#60a5fa"
            stroke-width="1"
            opacity="0.6"
          />
          <line
            x1={pos().x - 14}
            y1={pos().y}
            x2={pos().x + 14}
            y2={pos().y}
            stroke="#60a5fa"
            stroke-width="1"
            opacity="0.6"
          />
          <circle cx={pos().x} cy={pos().y} r="3" fill="#60a5fa" opacity="0.8" />
          <text x={pos().x + 12} y={pos().y - 10} fill="#60a5fa" font-size="10" font-family="monospace" opacity="0.7">
            {pos().x.toFixed(0)}, {pos().y.toFixed(0)}
          </text>
        </svg>
      )}
    </Show>
  );
}
