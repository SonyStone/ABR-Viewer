import { makeEventListener } from '@solid-primitives/event-listener';
import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { Vec2 } from '../core/types';

// ============================================================================
// MARK: Types
// ============================================================================

export type DragStartEvent = {
  /** Pointer position when the threshold was exceeded. */
  position: Vec2;
  /** Pointer position at the initial pointerdown. */
  origin: Vec2;
  /** The original PointerEvent that started the drag. */
  pointerEvent: PointerEvent;
};

export type DragMoveEvent = {
  /** Current pointer position. */
  position: Vec2;
  /** Delta from the initial pointerdown position (origin). */
  delta: Vec2;
};

export type DragEndEvent = {
  /** Final pointer position. */
  position: Vec2;
  /** Total delta from the initial pointerdown position (origin). */
  delta: Vec2;
};

export type DragSensorOptions = {
  /**
   * Pixels the pointer must travel (Euclidean) before a drag is detected.
   * This prevents accidental drags on click.
   * @default 8
   */
  threshold?: number;
  /** Called when drag starts (threshold exceeded). */
  onDragStart?: (event: DragStartEvent) => void;
  /** Called on every pointer move during an active drag. */
  onDragMove?: (event: DragMoveEvent) => void;
  /** Called when the pointer is released during an active drag. */
  onDragEnd?: (event: DragEndEvent) => void;
  /** Called when the drag is cancelled (pointer cancel or Escape key). */
  onDragCancel?: () => void;
  /**
   * Called when the pointer is released **without** exceeding the drag threshold.
   * This is a "click" — the user pressed and released without dragging.
   * Receives the original PointerEvent so modifiers (Ctrl, Shift) are available.
   */
  onClick?: (ev: PointerEvent) => void;
};

export type DragSensor = {
  /** Whether a drag is currently in progress (threshold exceeded). */
  isDragging: Accessor<boolean>;
  /** Current pointer position during drag, or null when idle. */
  position: Accessor<Vec2 | null>;
  /** Delta from the initial pointerdown position (origin), or null when idle. */
  delta: Accessor<Vec2 | null>;
  /** Pointer type of the current/last drag ('mouse' | 'touch' | 'pen'). */
  pointerType: Accessor<string>;
  /** Bind this to `onPointerDown` on the drag handle element. */
  onPointerDown: (ev: PointerEvent) => void;
  /** Programmatically cancel the current drag. */
  cancel: () => void;
};

// ============================================================================
// MARK: createDragSensor
// ============================================================================

/**
 * A low-level primitive that detects drag gestures from pointer events.
 *
 * ## How it works
 *
 * 1. Bind `onPointerDown` to a DOM element (the drag handle).
 * 2. On pointerdown, the sensor captures the pointer (`setPointerCapture`)
 *    and begins tracking movement.
 * 3. Once the pointer moves past `threshold` pixels, `onDragStart` fires
 *    and `isDragging()` becomes `true`.
 * 4. Subsequent pointer moves fire `onDragMove` with position + delta.
 * 5. On pointerup, `onDragEnd` fires. On Escape or pointercancel, `onDragCancel` fires.
 *
 * ## Why setPointerCapture?
 *
 * - All subsequent pointer events are delivered to the capturing element,
 *   even if the pointer moves outside it (or over iframes).
 * - No document-level listeners needed — cleaner and more reliable.
 * - Automatically released on pointerup/pointercancel.
 *
 * @example
 * ```tsx
 * const sensor = createDragSensor({
 *   onDragStart: (e) => console.log('Started at', e.position),
 *   onDragMove: (e) => console.log('Delta', e.delta),
 *   onDragEnd: (e) => console.log('Ended at', e.position),
 * });
 *
 * return <div onPointerDown={sensor.onPointerDown}>Drag me</div>;
 * ```
 */
export function createDragSensor(options: DragSensorOptions = {}): DragSensor {
  const threshold = () => options.threshold ?? 8;

  // ── Reactive state ──────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = createSignal(false);
  const [position, setPosition] = createSignal<Vec2 | null>(null);
  const [delta, setDelta] = createSignal<Vec2 | null>(null);
  const [pointerType, setPointerType] = createSignal<string>('mouse');

  // ── Internal mutable state (not reactive — perf-critical) ─────────────
  let tracking = false; // pointerdown received, waiting for threshold
  let dragging = false; // threshold exceeded, actively dragging
  let origin: Vec2 = Vec2.Zero; // position at pointerdown
  let capturedElement: HTMLElement | null = null;
  let capturedPointerId: number | null = null;
  let startPointerEvent: PointerEvent | null = null;

  // ── Escape key handler ────────────────────────────────────────────────
  // Registered globally — we only act on it when tracking/dragging.
  if (typeof document !== 'undefined') {
    makeEventListener(document, 'keydown', ((ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && (tracking || dragging)) {
        cancelDrag();
      }
    }) as EventListener);
  }

  // ── Cleanup on component unmount ──────────────────────────────────────
  onCleanup(() => {
    releaseCapture();
    resetState();
  });

  // ── Event handlers ────────────────────────────────────────────────────

  function onPointerDown(ev: PointerEvent): void {
    // Only handle primary pointer (left mouse / first finger)
    if (ev.button !== 0 || !ev.isPrimary) return;
    // Don't start a new drag if one is already active
    if (tracking || dragging) return;

    const target = ev.currentTarget as HTMLElement;
    if (!target) return;

    // Prevent browser default touch actions (scroll, pan, zoom) so the
    // pointer isn't cancelled mid-drag. The element should also have
    // CSS `touch-action: none` for this to work reliably.
    ev.preventDefault();

    // Capture the pointer for reliable tracking
    target.setPointerCapture(ev.pointerId);
    capturedElement = target;
    capturedPointerId = ev.pointerId;

    // Record the starting position
    origin = Vec2.of(ev.clientX, ev.clientY);
    tracking = true;
    startPointerEvent = ev;
    setPointerType(ev.pointerType);

    // Attach pointer events on the capturing element
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerCancel);
    target.addEventListener('lostpointercapture', onLostCapture);
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!ev.isPrimary) return;

    const pos = Vec2.of(ev.clientX, ev.clientY);

    if (tracking && !dragging) {
      // Still in threshold detection phase
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const distSq = dx * dx + dy * dy;
      const threshSq = threshold() * threshold();

      if (distSq < threshSq) return;

      // Threshold exceeded — transition to dragging
      tracking = false;
      dragging = true;

      const d = Vec2.of(pos.x - origin.x, pos.y - origin.y);
      setIsDragging(true);
      setPosition(pos);
      setDelta(d);

      options.onDragStart?.({
        position: pos,
        origin,
        pointerEvent: startPointerEvent!
      });
      return;
    }

    if (dragging) {
      const d = Vec2.of(pos.x - origin.x, pos.y - origin.y);
      setPosition(pos);
      setDelta(d);

      options.onDragMove?.({
        position: pos,
        delta: d
      });
    }
  }

  function onPointerUp(ev: PointerEvent): void {
    if (!ev.isPrimary) return;

    if (dragging) {
      const pos = Vec2.of(ev.clientX, ev.clientY);
      const d = Vec2.of(pos.x - origin.x, pos.y - origin.y);

      options.onDragEnd?.({
        position: pos,
        delta: d
      });
    } else if (tracking) {
      // Threshold was never exceeded — this was a click, not a drag.
      options.onClick?.(ev);
    }

    // Whether we were tracking (click) or dragging (drag), clean up
    releaseCapture();
    resetState();
  }

  function onPointerCancel(_ev: PointerEvent): void {
    if (dragging) {
      options.onDragCancel?.();
    }
    releaseCapture();
    resetState();
  }

  function onLostCapture(_ev: PointerEvent): void {
    // If we lose capture unexpectedly (e.g., another element steals it),
    // treat it as a cancel.
    if (tracking || dragging) {
      if (dragging) {
        options.onDragCancel?.();
      }
      resetState();
      // Don't call releaseCapture — we already lost it.
      cleanupListeners();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  function cancelDrag(): void {
    if (dragging) {
      options.onDragCancel?.();
    }
    releaseCapture();
    resetState();
  }

  function releaseCapture(): void {
    if (capturedElement && capturedPointerId !== null) {
      try {
        capturedElement.releasePointerCapture(capturedPointerId);
      } catch {
        // Already released — ignore
      }
    }
    cleanupListeners();
  }

  function cleanupListeners(): void {
    if (capturedElement) {
      capturedElement.removeEventListener('pointermove', onPointerMove);
      capturedElement.removeEventListener('pointerup', onPointerUp);
      capturedElement.removeEventListener('pointercancel', onPointerCancel);
      capturedElement.removeEventListener('lostpointercapture', onLostCapture);
    }
  }

  function resetState(): void {
    tracking = false;
    dragging = false;
    origin = Vec2.Zero;
    capturedElement = null;
    capturedPointerId = null;
    startPointerEvent = null;
    setIsDragging(false);
    setPosition(null);
    setDelta(null);
  }

  return {
    isDragging,
    position,
    delta,
    pointerType,
    onPointerDown,
    cancel: cancelDrag
  };
}
