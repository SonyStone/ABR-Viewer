import { createSignal, type Accessor } from 'solid-js';
import { calculateDeltas, measureElements, type ElementSnapshot } from './flipUtils';

// ============================================================================
// MARK: Types
// ============================================================================

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
    firstSnapshot = measureElements(options.elements);
  }

  // ── Last + Invert + Play ──────────────────────────────────────────────
  function playFromFirst(): void {
    if (!firstSnapshot) return;

    // Cancel any running animations from a previous FLIP cycle
    cancelActive();

    const lastSnapshot = measureElements(options.elements);
    const deltas = calculateDeltas(firstSnapshot, lastSnapshot);
    firstSnapshot = null;

    if (deltas.size === 0) return;

    const dur = options.duration ?? 200;
    const ease = options.easing ?? 'ease-out';

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

  return { captureFirst, playFromFirst, isAnimating };
}
