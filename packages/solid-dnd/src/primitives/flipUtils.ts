// ============================================================================
// MARK: Types
// ============================================================================

/**
 * A snapshot of an element's bounding rect at a point in time.
 * Captured via `getBoundingClientRect()`.
 */
export type ElementSnapshot = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/**
 * The inverse translation needed to visually move an element from its
 * "Last" (new) position back to its "First" (old) position.
 *
 * Applied as `translate(dx, dy)` at animation start, then animated to
 * `translate(0, 0)` to smoothly arrive at the new position.
 */
export type FlipDelta = Readonly<{
  dx: number;
  dy: number;
}>;

// ============================================================================
// MARK: measureElements
// ============================================================================

/**
 * Captures the current bounding rect of every element in the map.
 * This is the "First" or "Last" step of FLIP.
 *
 * @param elements Map of item keys → DOM elements to measure.
 * @returns A new map of item keys → snapshot rects (viewport-relative).
 */
export function measureElements(elements: Map<string, HTMLElement>): Map<string, ElementSnapshot> {
  const snapshots = new Map<string, ElementSnapshot>();
  for (const [key, el] of elements) {
    // Skip detached elements (e.g., stale refs from items removed by <For>).
    // getBoundingClientRect() on detached elements returns all-zero rects,
    // which would produce incorrect FLIP deltas.
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    snapshots.set(key, { x: r.left, y: r.top, width: r.width, height: r.height });
  }
  return snapshots;
}

// ============================================================================
// MARK: calculateDeltas
// ============================================================================

/**
 * Computes the inverse translation for each element that moved between
 * the "First" and "Last" snapshots. This is the "Invert" step of FLIP.
 *
 * - Elements present in both snapshots that **moved**: included with delta.
 * - Elements that **didn't move**: excluded (delta is zero).
 * - Elements only in `last` (newly added): excluded — they just appear.
 * - Elements only in `first` (removed): excluded — they're already gone.
 *
 * @param first Snapshot taken before the DOM change.
 * @param last  Snapshot taken after the DOM change.
 * @returns Map of keys → inverse translation deltas for elements that moved.
 */
/**
 * Compares two element snapshots for exact positional equality.
 * Used by createFlip to detect whether animation targets have changed.
 */
export function snapshotsEqual(a: Map<string, ElementSnapshot>, b: Map<string, ElementSnapshot>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, snapA] of a) {
    const snapB = b.get(key);
    if (!snapB) return false;
    if (snapA.x !== snapB.x || snapA.y !== snapB.y || snapA.width !== snapB.width || snapA.height !== snapB.height)
      return false;
  }
  return true;
}

export function calculateDeltas(
  first: Map<string, ElementSnapshot>,
  last: Map<string, ElementSnapshot>
): Map<string, FlipDelta> {
  const deltas = new Map<string, FlipDelta>();

  for (const [key, lastSnap] of last) {
    const firstSnap = first.get(key);
    if (!firstSnap) continue;

    const dx = firstSnap.x - lastSnap.x;
    const dy = firstSnap.y - lastSnap.y;

    // Skip elements that didn't move (avoids unnecessary animations)
    if (dx === 0 && dy === 0) continue;

    deltas.set(key, { dx, dy });
  }

  return deltas;
}
