import { batch, createSignal, type Accessor } from 'solid-js';
import { calculateDeltas, measureElements, snapshotsEqual, type ElementSnapshot, type FlipDelta } from './flipUtils';

// ============================================================================
// MARK: Types
// ============================================================================

/**
 * Describes a single element's FLIP animation for debug/visualization.
 */
export type FlipAnimateEntry = {
  /** The item key. */
  key: string;
  /** Center position before the DOM change (viewport coords). */
  from: { x: number; y: number };
  /** Center position after the DOM change (viewport coords). */
  to: { x: number; y: number };
  /** The inverse delta applied at animation start. */
  delta: FlipDelta;
};

export type FlipOptions = {
  /**
   * Duration of the FLIP animation in milliseconds.
   * Read each time `playFromFirst` is called, so it can be dynamic.
   * @default 200
   */
  duration?: number;
  /**
   * CSS easing string for the animation.
   * Read each time `playFromFirst` is called, so it can be dynamic.
   * @default 'ease-out'
   */
  easing?: string;
  /**
   * Map of item keys → DOM elements. Mutated externally as items mount/unmount.
   * The flip primitive reads from this map when measuring positions.
   */
  elements: Map<string, HTMLElement>;
  /**
   * Called when a FLIP animation cycle starts. Receives an array of entries
   * describing each element's motion. Useful for debug visualization.
   */
  onAnimate?: (entries: FlipAnimateEntry[]) => void;
};

export type Flip = {
  /**
   * Capture the current position of all elements ("First" snapshot).
   * Call this **before** the DOM change (e.g., before reordering items).
   */
  captureFirst: () => void;
  /**
   * Capture new positions ("Last"), compute inverse transforms ("Invert"),
   * and play the animation ("Play").
   *
   * Call this **after** the DOM has been updated. In SolidJS, signal writes
   * cause synchronous DOM updates, so you can call this immediately after
   * `setItems(newOrder)`.
   *
   * If `captureFirst` was not called beforehand, this is a no-op.
   */
  playFromFirst: () => void;
  /**
   * Convenience wrapper: captures first, runs `fn` (which should mutate the DOM),
   * then plays the animation.
   *
   * Equivalent to:
   * ```ts
   * flip.captureFirst();
   * fn();
   * flip.playFromFirst();
   * ```
   *
   * Accepts an optional per-call duration override.
   */
  animate: (fn: () => void, overrides?: { duration?: number }) => void;
  /**
   * Whether a FLIP animation is currently in progress.
   * Useful for disabling pointer events or other interactions during animation.
   */
  isAnimating: Accessor<boolean>;
};

// ============================================================================
// MARK: createFlip
// ============================================================================

/**
 * A primitive that animates layout transitions using the FLIP technique.
 *
 * ## How it works
 *
 * 1. **First** — Call `captureFirst()` before the DOM change to snapshot positions.
 * 2. *Make your DOM change* (e.g., reorder items via a SolidJS signal).
 * 3. **Last + Invert + Play** — Call `playFromFirst()` after the DOM change.
 *    It captures new positions, computes inverse transforms, and animates
 *    each element from its old position to its new position.
 *
 * Uses the Web Animations API for clean cancellation and no CSS side effects.
 *
 * ## Element lifecycle
 *
 * - **Moved elements**: animated from old position to new position.
 * - **New elements** (not in "First" snapshot): just appear, no animation.
 * - **Removed elements** (not in "Last" snapshot): already gone, no animation.
 * - **Stationary elements**: skipped (no unnecessary animations).
 *
 * @example
 * ```tsx
 * const refs = new Map<string, HTMLElement>();
 * const flip = createFlip({ elements: refs, duration: 250 });
 *
 * function reorder(newItems: Item[]) {
 *   flip.captureFirst();
 *   setItems(newItems); // SolidJS updates DOM synchronously
 *   flip.playFromFirst();
 * }
 * ```
 */
export function createFlip(options: FlipOptions): Flip {
  const [isAnimating, setIsAnimating] = createSignal(false);

  let firstSnapshot: Map<string, ElementSnapshot> | null = null;
  let activeAnimations: Animation[] = [];

  // Track the target positions and start time of the current animation cycle.
  // When playFromFirst() is called redundantly (same targets), we use the
  // remaining time so the animation still completes on schedule.
  let lastTargets: Map<string, ElementSnapshot> | null = null;
  let animationStartTime = 0;
  // Per-call duration override set by animate(), consumed by playFromFirst().
  let animateDurationOverride: number | undefined;

  // ── First: capture current positions ──────────────────────────────────
  function captureFirst(): void {
    // Simply measure current visual positions. getBoundingClientRect()
    // includes Web Animation API transforms, so this captures where
    // elements truly are on screen — even mid-animation.
    firstSnapshot = measureElements(options.elements);
  }

  // ── Last + Invert + Play ──────────────────────────────────────────────
  function playFromFirst(): void {
    if (!firstSnapshot) return;
    const first = firstSnapshot;
    firstSnapshot = null;

    // Cancel any still-running animations so elements snap to their
    // current position and getBoundingClientRect() reads layout values.
    cancelActive();

    const lastSnapshot = measureElements(options.elements);
    const deltas = calculateDeltas(first, lastSnapshot);

    if (deltas.size === 0) {
      lastTargets = null;
      return;
    }

    const baseDur = animateDurationOverride ?? options.duration ?? 200;
    const ease = options.easing ?? 'ease-out';

    // If targets haven't changed (same layout as previous animation),
    // use remaining time so the overall animation finishes on schedule
    // instead of restarting a full-duration animation every call.
    const targetsUnchanged = lastTargets !== null && snapshotsEqual(lastTargets, lastSnapshot);
    let dur: number;
    if (targetsUnchanged && animationStartTime > 0) {
      const elapsed = performance.now() - animationStartTime;
      dur = Math.max(baseDur - elapsed, 16);
    } else {
      dur = baseDur;
      animationStartTime = performance.now();
    }
    lastTargets = lastSnapshot;

    // Fire debug callback with animation entries
    if (options.onAnimate) {
      const entries: FlipAnimateEntry[] = [];
      for (const [key, delta] of deltas) {
        const snap = lastSnapshot.get(key);
        if (!snap) continue;
        entries.push({
          key,
          from: { x: snap.x + snap.width / 2 + delta.dx, y: snap.y + snap.height / 2 + delta.dy },
          to: { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 },
          delta
        });
      }
      options.onAnimate(entries);
    }

    setIsAnimating(true);
    const animations: Animation[] = [];

    for (const [key, delta] of deltas) {
      const el = options.elements.get(key);
      if (!el || typeof el.animate !== 'function') continue;

      const hasScale = delta.scaleX !== 1 || delta.scaleY !== 1;
      const fromTransform = hasScale
        ? `translate(${delta.dx}px, ${delta.dy}px) scale(${delta.scaleX}, ${delta.scaleY})`
        : `translate(${delta.dx}px, ${delta.dy}px)`;
      const toTransform = hasScale ? 'translate(0, 0) scale(1, 1)' : 'translate(0, 0)';

      const anim = el.animate([{ transform: fromTransform }, { transform: toTransform }], {
        duration: dur,
        easing: ease
      });

      animations.push(anim);
    }

    if (animations.length === 0) {
      setIsAnimating(false);
      return;
    }

    activeAnimations = animations;

    // Wait for all animations to finish, then clear the animating state.
    // If cancelActive() is called before they finish, the promises reject
    // (via cancel) and we ignore them.
    const currentBatch = animations;
    Promise.all(animations.map((a) => a.finished))
      .then(() => {
        // Only clear if this is still the active batch (not replaced by a newer FLIP).
        // IMPORTANT: Clear activeAnimations BEFORE the signal write.
        // setIsAnimating(false) triggers synchronous SolidJS effects which may
        // call playFromFirst() and start a NEW animation batch. If we cleared
        // activeAnimations after, we'd overwrite the new batch, orphaning it
        // so isAnimating gets stuck at true and all future moves are swallowed.
        if (activeAnimations === currentBatch) {
          activeAnimations = [];
          setIsAnimating(false);
        }
      })
      .catch(() => {
        // Animation was cancelled — ignore
      });
  }

  // ── Cancel running animations ─────────────────────────────────────────
  function cancelActive(): void {
    for (const anim of activeAnimations) {
      anim.cancel();
    }
    activeAnimations = [];
    if (isAnimating()) {
      setIsAnimating(false);
    }
  }

  // ── Convenience: capture + mutate + play in one call ───────────────────
  function animate(fn: () => void, overrides?: { duration?: number }): void {
    // animate() is a discrete operation (e.g., on dragEnd).
    // Reset animation tracking so playFromFirst() uses full duration.
    lastTargets = null;
    animationStartTime = 0;
    // Use a local override instead of mutating the caller's options object.
    animateDurationOverride = overrides?.duration;
    captureFirst();
    batch(() => fn());
    playFromFirst();
    animateDurationOverride = undefined;
  }

  return { captureFirst, playFromFirst, animate, isAnimating };
}
