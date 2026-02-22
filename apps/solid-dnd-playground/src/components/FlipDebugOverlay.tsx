import type { FlipAnimateEntry } from 'solid-dnd';
import { createEffect, createSignal, For, on, onCleanup, Show, type Accessor, type JSX } from 'solid-js';

// ============================================================================
// MARK: Types
// ============================================================================

type Point = { x: number; y: number };

type CycleMarker = {
  /** Cycle number (1-based). */
  number: number;
  /** Position of gap center when this FLIP cycle fired. */
  position: Point;
};

type ElementTrail = {
  key: string;
  from: Point;
  to: Point;
  /** Sampled positions via RAF during the FLIP animation. */
  trail: Point[];
  color: string;
};

type CycleTrails = {
  /** Which FLIP cycle these trails belong to (1-based). */
  cycle: number;
  trails: ElementTrail[];
};

// ============================================================================
// MARK: Constants
// ============================================================================

const COLORS = [
  '#f87171', // red-400
  '#fb923c', // orange-400
  '#facc15', // yellow-400
  '#4ade80', // green-400
  '#22d3ee', // cyan-400
  '#60a5fa', // blue-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#34d399', // emerald-400
  '#fbbf24' // amber-400
];

// ============================================================================
// MARK: Helpers
// ============================================================================

function getCenter(el: HTMLElement): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Find the gap element in the elements map.
 * Handles both flat demos (`__dnd_gap__`) and nested demos (`__gap_root__`, etc.).
 */
function findGapElement(elements: Map<string, HTMLElement>): HTMLElement | null {
  const direct = elements.get('__dnd_gap__');
  if (direct?.isConnected) return direct;
  for (const [key, el] of elements) {
    if (key.startsWith('__gap_') && el.isConnected) return el;
  }
  return null;
}

function pointsToSvg(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function roundPt(p: Point): { x: number; y: number } {
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
}

// ============================================================================
// MARK: FlipDebugOverlay
// ============================================================================

export type FlipDebugOverlayProps = {
  /** Animation entries from `createFlip`'s `onAnimate` callback. */
  entries: Accessor<FlipAnimateEntry[]>;
  /** The elements map — used to sample live positions via RAF. */
  elements: Map<string, HTMLElement>;
  /** Whether a FLIP animation is currently running. */
  isAnimating: Accessor<boolean>;
  /** Whether to show the overlay. */
  enabled: Accessor<boolean>;
  /** Whether a drag session is active (start → drop/cancel). */
  isDragging: Accessor<boolean>;
};

/**
 * Full-screen SVG overlay that visualizes the gap element's trajectory
 * across an entire drag session, plus per-element FLIP animation trails
 * accumulated across all FLIP cycles.
 *
 * **Gap trail** (primary — cyan):
 * - Thick polyline tracking the gap from drag start → drop/cancel
 * - Green **START** marker and red **END** marker
 * - Numbered yellow cycle markers where each FLIP cycle fired
 *
 * **Element trails** (secondary — all cycles accumulated):
 * - Thin colored polylines for each animated element, per cycle
 * - Dashed line showing expected straight path
 *
 * **Copy Debug** button serializes all trajectory data as JSON for pasting.
 */
export function FlipDebugOverlay(props: FlipDebugOverlayProps): JSX.Element {
  // ── Persistent gap trail (entire drag session) ──────────────────────────
  const [gapTrail, setGapTrail] = createSignal<Point[]>([]);
  const [cycleMarkers, setCycleMarkers] = createSignal<CycleMarker[]>([]);

  // ── Per-FLIP-cycle element trails (accumulated across session) ──────────
  const [allCycleTrails, setAllCycleTrails] = createSignal<CycleTrails[]>([]);

  // ── Copy feedback ───────────────────────────────────────────────────────
  const [copied, setCopied] = createSignal(false);

  let gapRafId: number | null = null;
  let gapSampling = false;
  let cycleCounter = 0;

  // ── Gap sampling RAF loop ───────────────────────────────────────────────

  function startGapSampling() {
    if (gapSampling) return;
    gapSampling = true;

    function sample() {
      if (!gapSampling) return;

      const gapEl = findGapElement(props.elements);
      if (gapEl) {
        const center = getCenter(gapEl);
        setGapTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(last.x - center.x) < 0.5 && Math.abs(last.y - center.y) < 0.5) {
            return prev;
          }
          return [...prev, center];
        });
      }

      gapRafId = requestAnimationFrame(sample);
    }

    gapRafId = requestAnimationFrame(sample);
  }

  function stopGapSampling() {
    gapSampling = false;
    if (gapRafId !== null) {
      cancelAnimationFrame(gapRafId);
      gapRafId = null;
    }
  }

  // ── Drag session lifecycle ──────────────────────────────────────────────

  createEffect(
    on(
      () => props.isDragging(),
      (dragging) => {
        if (!props.enabled()) return;

        if (dragging) {
          // New drag session — clear old data and start sampling
          setGapTrail([]);
          setCycleMarkers([]);
          setAllCycleTrails([]);
          cycleCounter = 0;
          setCopied(false);
          startGapSampling();
        } else {
          // Drag ended — take final sample and stop
          const gapEl = findGapElement(props.elements);
          if (gapEl) {
            const center = getCenter(gapEl);
            setGapTrail((prev) => [...prev, center]);
          }
          stopGapSampling();
        }
      }
    )
  );

  // ── FLIP cycle tracking ─────────────────────────────────────────────────

  createEffect(
    on(
      () => props.entries(),
      (entries) => {
        if (!props.enabled() || entries.length === 0) return;

        // Add cycle marker at current gap position
        cycleCounter++;
        const currentCycle = cycleCounter;

        const gapEl = findGapElement(props.elements);
        if (gapEl) {
          const center = getCenter(gapEl);
          setCycleMarkers((prev) => [...prev, { number: currentCycle, position: center }]);
        }

        // Build per-element trails for this cycle
        const newTrails: ElementTrail[] = entries.map((e, i) => ({
          key: e.key,
          from: { ...e.from },
          to: { ...e.to },
          trail: [],
          color: COLORS[i % COLORS.length]
        }));

        // Append this cycle's trails to the accumulated list
        setAllCycleTrails((prev) => [...prev, { cycle: currentCycle, trails: newTrails }]);

        // Start RAF sampling for element positions during this FLIP animation
        let elemRafId: number | null = null;
        let elemRunning = true;

        function sampleElements() {
          if (!elemRunning) return;

          setAllCycleTrails((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.cycle !== currentCycle) return prev;

            const updatedTrails = last.trails.map((t) => {
              const el = props.elements.get(t.key);
              if (!el?.isConnected) return t;
              const center = getCenter(el);
              const lastPt = t.trail[t.trail.length - 1];
              if (lastPt && Math.abs(lastPt.x - center.x) < 0.5 && Math.abs(lastPt.y - center.y) < 0.5) return t;
              return { ...t, trail: [...t.trail, center] };
            });
            return [...prev.slice(0, -1), { ...last, trails: updatedTrails }];
          });

          if (props.isAnimating()) {
            elemRafId = requestAnimationFrame(sampleElements);
          } else {
            // Final sample
            setAllCycleTrails((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.cycle !== currentCycle) return prev;
              const updatedTrails = last.trails.map((t) => {
                const el = props.elements.get(t.key);
                if (!el?.isConnected) return t;
                const center = getCenter(el);
                return { ...t, trail: [...t.trail, center] };
              });
              return [...prev.slice(0, -1), { ...last, trails: updatedTrails }];
            });
            elemRunning = false;
          }
        }

        elemRafId = requestAnimationFrame(sampleElements);

        onCleanup(() => {
          elemRunning = false;
          if (elemRafId !== null) cancelAnimationFrame(elemRafId);
        });
      },
      { defer: true }
    )
  );

  // ── Cleanup ─────────────────────────────────────────────────────────────
  onCleanup(() => stopGapSampling());

  // ── Copy debug data ─────────────────────────────────────────────────────

  function copyDebugData() {
    const data = {
      gapTrail: gapTrail().map(roundPt),
      gapSamples: gapTrail().length,
      cycleMarkers: cycleMarkers().map((m) => ({
        cycle: m.number,
        position: roundPt(m.position)
      })),
      elementTrails: allCycleTrails().map((ct) => ({
        cycle: ct.cycle,
        elements: ct.trails.map((t) => ({
          key: t.key,
          from: roundPt(t.from),
          to: roundPt(t.to),
          samples: t.trail.length,
          trail: t.trail.map(roundPt)
        }))
      }))
    };

    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const hasData = () => gapTrail().length > 0 || allCycleTrails().length > 0;

  return (
    <Show when={props.enabled() && hasData()}>
      <svg class="pointer-events-none fixed inset-0 z-[9999]" style={{ width: '100vw', height: '100vh' }}>
        {/* ── Per-element FLIP trails (all cycles, secondary) ─────── */}
        <For each={allCycleTrails()}>
          {(ct) => (
            <For each={ct.trails}>
              {(t) => (
                <>
                  {/* Actual trajectory */}
                  <Show when={t.trail.length >= 2}>
                    <polyline
                      points={pointsToSvg(t.trail)}
                      fill="none"
                      stroke={t.color}
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      opacity="0.4"
                    />
                  </Show>

                  {/* Start/end dots */}
                  <circle cx={t.from.x} cy={t.from.y} r="2.5" fill={t.color} opacity="0.4" />
                  <circle cx={t.to.x} cy={t.to.y} r="2.5" fill={t.color} opacity="0.4" />

                  {/* Label (only on first cycle to avoid clutter) */}
                  <Show when={ct.cycle === 1}>
                    <text
                      x={t.from.x + 6}
                      y={t.from.y - 6}
                      fill={t.color}
                      font-size="8"
                      font-family="monospace"
                      opacity="0.5"
                    >
                      {t.key}
                    </text>
                  </Show>
                </>
              )}
            </For>
          )}
        </For>

        {/* ── Gap trail (primary — cyan) ──────────────────────────── */}
        <Show when={gapTrail().length >= 2}>
          <polyline
            points={pointsToSvg(gapTrail())}
            fill="none"
            stroke="#22d3ee"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.9"
          />
        </Show>

        {/* Gap trail sample dots */}
        <For each={gapTrail()}>
          {(p, i) => (
            <circle
              cx={p.x}
              cy={p.y}
              r="2"
              fill={
                i() === 0 ? '#4ade80' : i() === gapTrail().length - 1 && !props.isDragging() ? '#f87171' : '#22d3ee'
              }
              opacity="0.7"
            />
          )}
        </For>

        {/* Start marker */}
        <Show when={gapTrail().length > 0}>
          {(() => {
            const start = gapTrail()[0];
            return (
              <>
                <circle cx={start.x} cy={start.y} r="6" fill="#4ade80" stroke="#000" stroke-width="0.5" />
                <text
                  x={start.x + 10}
                  y={start.y + 3}
                  fill="#4ade80"
                  font-size="10"
                  font-weight="bold"
                  font-family="monospace"
                >
                  START
                </text>
              </>
            );
          })()}
        </Show>

        {/* End marker (only shown after drag ends) */}
        <Show when={!props.isDragging() && gapTrail().length > 1}>
          {(() => {
            const trail = gapTrail();
            const end = trail[trail.length - 1];
            return (
              <>
                <circle cx={end.x} cy={end.y} r="6" fill="#f87171" stroke="#000" stroke-width="0.5" />
                <text
                  x={end.x + 10}
                  y={end.y + 3}
                  fill="#f87171"
                  font-size="10"
                  font-weight="bold"
                  font-family="monospace"
                >
                  END
                </text>
              </>
            );
          })()}
        </Show>

        {/* FLIP cycle markers */}
        <For each={cycleMarkers()}>
          {(marker) => (
            <>
              <circle
                cx={marker.position.x}
                cy={marker.position.y}
                r="10"
                fill="none"
                stroke="#facc15"
                stroke-width="2"
              />
              <text
                x={marker.position.x}
                y={marker.position.y + 4}
                fill="#facc15"
                font-size="9"
                font-weight="bold"
                font-family="monospace"
                text-anchor="middle"
              >
                {marker.number}
              </text>
            </>
          )}
        </For>

        {/* ── Legend ───────────────────────────────────────────────── */}
        <g transform="translate(10, 20)">
          <line x1="-6" y1="0" x2="12" y2="0" stroke="#22d3ee" stroke-width="3" opacity="0.9" />
          <text x="18" y="3" fill="#22d3ee" font-size="9" font-family="monospace" opacity="0.9">
            gap trail
          </text>

          <circle cx="3" cy="14" r="4" fill="#4ade80" />
          <text x="18" y="17" fill="#4ade80" font-size="9" font-family="monospace" opacity="0.8">
            drag start
          </text>

          <circle cx="3" cy="28" r="4" fill="#f87171" />
          <text x="18" y="31" fill="#f87171" font-size="9" font-family="monospace" opacity="0.8">
            drop / cancel
          </text>

          <circle cx="3" cy="42" r="8" fill="none" stroke="#facc15" stroke-width="1.5" />
          <text x="18" y="45" fill="#facc15" font-size="9" font-family="monospace" opacity="0.8">
            FLIP cycle
          </text>

          <line x1="-6" y1="56" x2="12" y2="56" stroke="#60a5fa" stroke-width="1.5" opacity="0.4" />
          <text x="18" y="59" fill="#888" font-size="9" font-family="monospace" opacity="0.6">
            element trails
          </text>
        </g>
      </svg>

      {/* ── Copy button (outside SVG so it's clickable) ─────────────── */}
      <button
        onClick={copyDebugData}
        class={`fixed top-2 right-2 z-[10000] flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
          copied()
            ? 'border-green-500/50 bg-green-950/90 text-green-300'
            : 'border-neutral-600 bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
        }`}
      >
        <span>{copied() ? '✓' : '📋'}</span>
        <span>{copied() ? 'Copied!' : 'Copy Debug'}</span>
      </button>
    </Show>
  );
}
