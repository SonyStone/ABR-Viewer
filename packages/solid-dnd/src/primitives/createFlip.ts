import { createSignal, type Accessor } from 'solid-js';
import { calculateDeltas, measureElements, type ElementSnapshot, type FlipDelta } from './flipUtils';

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

  // ── First: capture current positions ──────────────────────────────────
  function captureFirst(): void {
    // If animations are in flight, finish them first so getBoundingClientRect()
    // returns the true resting positions, not mid-animation transforms.
    finishActive();
    firstSnapshot = measureElements(options.elements);
  }

  // ── Last + Invert + Play ──────────────────────────────────────────────
  function playFromFirst(): void {
    if (!firstSnapshot) return;

    // Cancel any still-running animations (shouldn't be any after
    // captureFirst finished them, but just in case).
    cancelActive();

    const lastSnapshot = measureElements(options.elements);
    const deltas = calculateDeltas(firstSnapshot, lastSnapshot);
    firstSnapshot = null;

    if (deltas.size === 0) return;

    const dur = options.duration ?? 200;
    const ease = options.easing ?? 'ease-out';

    // Fire debug callback with animation entries
    if (options.onAnimate) {
      const entries: FlipAnimateEntry[] = [];
      for (const [key, delta] of deltas) {
        const last = lastSnapshot.get(key);
        if (!last) continue;
        entries.push({
          key,
          from: { x: last.x + last.width / 2 + delta.dx, y: last.y + last.height / 2 + delta.dy },
          to: { x: last.x + last.width / 2, y: last.y + last.height / 2 },
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

      const anim = el.animate(
        [{ transform: `translate(${delta.dx}px, ${delta.dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: dur, easing: ease }
      );

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
        // Only clear if this is still the active batch (not replaced by a newer FLIP)
        if (activeAnimations === currentBatch) {
          setIsAnimating(false);
          activeAnimations = [];
        }
      })
      .catch(() => {
        // Animation was cancelled — ignore
      });
  }

  // ── Finish running animations (snap to end) ────────────────────────────
  function finishActive(): void {
    if (activeAnimations.length === 0) return;
    for (const anim of activeAnimations) {
      // finish() snaps to the final keyframe; fall back to cancel() in
      // environments where finish() isn't available (e.g., jsdom mocks).
      if (typeof anim.finish === 'function') {
        anim.finish();
      } else {
        anim.cancel();
      }
    }
    activeAnimations = [];
    if (isAnimating()) {
      setIsAnimating(false);
    }
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
    const prevDuration = options.duration;
    if (overrides?.duration !== undefined) {
      options.duration = overrides.duration;
    }
    captureFirst();
    fn();
    playFromFirst();
    // Restore original duration so the options object isn't permanently mutated
    options.duration = prevDuration;
  }

  return { captureFirst, playFromFirst, animate, isAnimating };
}
