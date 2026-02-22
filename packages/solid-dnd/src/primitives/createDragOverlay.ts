import { type Accessor, createMemo, createSignal } from 'solid-js';
import { fromElement, type Rect } from '../core/rect';
import { type Vec2, of as vec2, Zero as Vec2Zero } from '../core/vec2';

// ============================================================================
// MARK: Types
// ============================================================================

export type DragOverlayOptions = {
  /**
   * Current pointer position (page coordinates) during drag.
   * Updated every pointer move. Comes from `createDragSensor`.
   */
  currentPosition: Accessor<Vec2 | null>;
};

export type DragOverlay = {
  /**
   * Top-left position for the overlay (page coordinates).
   * Use with `position: fixed; left: ...; top: ...;` on the overlay element.
   *
   * Returns `Vec2.Zero` when not active.
   */
  position: Accessor<Vec2>;
  /**
   * Width and height of the source element at drag start.
   * Use to size the overlay to match the original item.
   *
   * Returns `Vec2.Zero` when not active.
   */
  size: Accessor<Vec2>;
  /**
   * The source element's bounding rect captured at drag start.
   * Useful for creating a clone or snapshot.
   *
   * Returns `undefined` when not active.
   */
  sourceRect: Accessor<Rect | undefined>;
  /**
   * Whether the overlay should be visible.
   */
  active: Accessor<boolean>;
  /**
   * Activate the overlay. Call in `onDragStart` with the source element
   * and the pointer position at that moment.
   *
   * Captures the element's bounding rect and computes the grab offset
   * (pointer position relative to element's top-left corner).
   */
  start: (element: HTMLElement, pointerPosition: Vec2) => void;
  /**
   * Deactivate the overlay. Call when drag ends or cancels.
   */
  stop: () => void;
};

// ============================================================================
// MARK: createDragOverlay
// ============================================================================

/**
 * A primitive that computes positioning for a floating drag overlay.
 *
 * Call `start(element, pointerPos)` when a drag begins to capture the
 * element's rect and compute the grab offset. During the drag, `position`
 * tracks `currentPosition - grabOffset` so the overlay follows the pointer
 * naturally.
 *
 * Call `stop()` when the drag ends.
 *
 * This uses an **imperative** start/stop API to avoid signal timing issues
 * — `onDragStart` can set drag state signals AND start the overlay in the
 * correct order, ensuring the source element is measured before any state
 * changes collapse it.
 *
 * ## Usage
 *
 * ```tsx
 * const sensor = createDragSensor({ ... });
 * const overlay = createDragOverlay({
 *   currentPosition: () => sensor.position() ?? Vec2.Zero,
 * });
 *
 * // In onDragStart:
 * overlay.start(sourceElement, e.position);
 *
 * // In onDragEnd / onDragCancel:
 * overlay.stop();
 *
 * // Render:
 * <Show when={overlay.active()}>
 *   <div style={{
 *     position: 'fixed',
 *     left: `${overlay.position().x}px`,
 *     top: `${overlay.position().y}px`,
 *     width: `${overlay.size().x}px`,
 *   }}>
 *     {overlayContent}
 *   </div>
 * </Show>
 * ```
 */
export function createDragOverlay(options: DragOverlayOptions): DragOverlay {
  const [isActive, setIsActive] = createSignal(false);
  const [grabOffset, setGrabOffset] = createSignal<Vec2>(Vec2Zero);
  const [capturedSize, setCapturedSize] = createSignal<Vec2>(Vec2Zero);
  const [capturedRect, setCapturedRect] = createSignal<Rect | undefined>(undefined);

  function start(element: HTMLElement, pointerPosition: Vec2): void {
    const rect = fromElement(element);
    if (rect) {
      setGrabOffset(vec2(pointerPosition.x - rect.x, pointerPosition.y - rect.y));
      setCapturedSize(vec2(rect.width, rect.height));
      setCapturedRect(rect);
    } else {
      setGrabOffset(Vec2Zero);
      setCapturedSize(Vec2Zero);
      setCapturedRect(undefined);
    }
    setIsActive(true);
  }

  function stop(): void {
    setIsActive(false);
    setGrabOffset(Vec2Zero);
    setCapturedSize(Vec2Zero);
    setCapturedRect(undefined);
  }

  // ── Current overlay position = pointer - grab offset ──────────────────
  const position = createMemo<Vec2>(() => {
    if (!isActive()) return Vec2Zero;
    const pos = options.currentPosition();
    if (!pos) return Vec2Zero;
    const offset = grabOffset();
    return vec2(pos.x - offset.x, pos.y - offset.y);
  });

  return {
    position,
    size: capturedSize,
    sourceRect: capturedRect,
    active: isActive,
    start,
    stop
  };
}
