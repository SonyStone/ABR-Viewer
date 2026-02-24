import {
  createDragOverlay,
  createDragSensor,
  createDropzone,
  createFlip,
  createSortable,
  GAP_KEY,
  Place,
  Rect,
  reorderItems,
  Vec2
} from 'solid-dnd';
import { batch, createEffect, createMemo, createSignal, For, on, Show, type JSX } from 'solid-js';

// ============================================================================
// MARK: OverlayFixture — tests createDragOverlay in a real browser
// ============================================================================

type Item = { id: string; label: string; color: string };

const INITIAL_ITEMS: Item[] = [
  { id: 'o1', label: 'Red', color: '#e74c3c' },
  { id: 'o2', label: 'Blue', color: '#3498db' },
  { id: 'o3', label: 'Green', color: '#2ecc71' },
  { id: 'o4', label: 'Orange', color: '#f39c12' },
  { id: 'o5', label: 'Purple', color: '#9b59b6' }
];

export default function OverlayFixture(): JSX.Element {
  const [items, setItems] = createSignal<Item[]>(INITIAL_ITEMS);
  const itemKeys = createMemo(() => items().map((i) => i.id));

  const [draggedIds, setDraggedIds] = createSignal<string[]>([]);
  const [dropPlace, setDropPlace] = createSignal<Place.Place<string> | undefined>(undefined, {
    equals: Place.equals
  });
  const [gapHeight, setGapHeight] = createSignal(0);
  let pendingDragId: string | null = null;
  let moveSwallowed = false;

  const itemRefs = new Map<string, HTMLElement>();
  let containerRef: HTMLElement | undefined;

  // ── Sortable ─────────────────────────────────────────────────────────
  const sortable = createSortable<string>({
    containerKey: 'list',
    items: itemKeys,
    draggedKeys: () => draggedIds(),
    getRect: (key) => Rect.fromElement(itemRefs.get(key)),
    getContainerRect: () => Rect.fromElement(containerRef)
  });

  // ── Dropzone (live gap — removes dragged items, inserts gap) ─────────
  const dropzone = createDropzone<string>({
    keys: itemKeys,
    draggedKeys: () => draggedIds(),
    place: dropPlace,
    containerKey: 'list'
  });

  // ── FLIP ─────────────────────────────────────────────────────────────
  const flip = createFlip({
    elements: itemRefs,
    duration: 300,
    easing: 'ease-out'
  });

  // ── Drag overlay ─────────────────────────────────────────────────────
  const overlay = createDragOverlay({
    currentPosition: () => sensor.position() ?? Vec2.Zero
  });

  // ── Animate display key changes during drag ─────────────────────────
  createEffect(
    on(
      () => dropzone.displayKeys(),
      () => {
        if (sensor.isDragging()) {
          flip.playFromFirst();
        }
      },
      { defer: true }
    )
  );

  // ── Re-evaluate insertion when FLIP animation ends ──────────────────
  createEffect(
    on(
      () => flip.isAnimating(),
      (animating) => {
        if (!animating && moveSwallowed && sensor.isDragging()) {
          moveSwallowed = false;
          const pos = insertionPos();
          if (pos) {
            flip.captureFirst();
            setDropPlace(sortable.getInsertionPoint(pos));
          }
        }
      },
      { defer: true }
    )
  );

  // ── Insertion position helper ─────────────────────────────────────
  // Use the overlay's center (not the raw cursor) for insertion point
  // detection. This ensures the insertion zone matches the visual position
  // of the dragged item, regardless of where the user grabbed it.
  // Without this, grabbing near an item's edge offsets the cursor from the
  // overlay center, making it feel like the gap lags behind the overlay.
  function insertionPos(): Vec2.Vec2 | undefined {
    if (overlay.active()) {
      const pos = overlay.position();
      const size = overlay.size();
      return Vec2.of(pos.x + size.x / 2, pos.y + size.y / 2);
    }
    return sensor.position() ?? undefined;
  }

  // ── Shared cleanup ──────────────────────────────────────────────────
  function resetDragState() {
    pendingDragId = null;
    moveSwallowed = false;
    setDraggedIds([]);
    setDropPlace(undefined);
    setGapHeight(0);
    overlay.stop();
    sortable.clearSnapshot();
    itemRefs.delete(GAP_KEY);
  }

  // ── Drag sensor ──────────────────────────────────────────────────────
  const sensor = createDragSensor({
    threshold: 5,
    proxyCapture: true,
    onClick: () => {
      pendingDragId = null;
    },
    onDragStart: (e) => {
      const id = pendingDragId;
      const ids = id ? [id] : [];

      // 1. Measure source element BEFORE any state changes
      const sourceEl = id ? itemRefs.get(id) : undefined;
      if (sourceEl) {
        setGapHeight(sourceEl.getBoundingClientRect().height);
        overlay.start(sourceEl, e.position);
      }

      // 2. Snapshot item rects BEFORE the gap shifts items.
      //    Pass the dragged ID so its space is removed from the snapshot,
      //    giving us compact positions that match the visual layout.
      sortable.snapshotRects(ids);

      // 3. Capture FLIP positions before DOM changes
      flip.captureFirst();

      // 4. Set drag state
      batch(() => {
        setDraggedIds(ids);
        setDropPlace(sortable.getInsertionPoint(insertionPos() ?? e.position));
      });
    },
    onDragMove: (_e) => {
      if (flip.isAnimating()) {
        moveSwallowed = true;
        return;
      }
      moveSwallowed = false;
      flip.captureFirst();
      const pos = insertionPos();
      if (pos) setDropPlace(sortable.getInsertionPoint(pos));
    },
    onDragEnd: () => {
      // If a move was swallowed during FLIP, do a final re-evaluation
      // before reading the drop place.
      if (moveSwallowed) {
        moveSwallowed = false;
        const pos = insertionPos();
        if (pos) {
          setDropPlace(sortable.getInsertionPoint(pos));
        }
      }

      const place = dropPlace();
      const ids = draggedIds();
      if (place && ids.length > 0) {
        flip.animate(() => {
          setItems((prev) => reorderItems(prev, ids, place, (i) => i.id));
          resetDragState();
        });
      } else {
        flip.animate(() => resetDragState());
      }
    },
    onDragCancel: () => {
      flip.animate(() => resetDragState());
    }
  });

  function handlePointerDown(id: string, ev: PointerEvent) {
    pendingDragId = id;
    sensor.onPointerDown(ev);
  }

  // ── Item lookup ─────────────────────────────────────────────────────
  const itemMap = createMemo(() => {
    const map = new Map<string, Item>();
    for (const item of items()) map.set(item.id, item);
    return map;
  });

  return (
    <div data-fixture="overlay">
      {/* State readouts */}
      <div style={{ display: 'flex', gap: '16px', 'margin-bottom': '12px', 'font-size': '13px' }}>
        <div>
          isDragging: <span data-testid="is-dragging">{sensor.isDragging() ? 'true' : 'false'}</span>
        </div>
        <div>
          overlayActive: <span data-testid="overlay-active">{overlay.active() ? 'true' : 'false'}</span>
        </div>
        <div>
          overlayPos:{' '}
          <span data-testid="overlay-position">
            {overlay.active() ? `${overlay.position().x.toFixed(0)},${overlay.position().y.toFixed(0)}` : 'none'}
          </span>
        </div>
        <div>
          overlaySize:{' '}
          <span data-testid="overlay-size">
            {overlay.active() ? `${overlay.size().x.toFixed(0)},${overlay.size().y.toFixed(0)}` : 'none'}
          </span>
        </div>
        <div>
          isAnimating: <span data-testid="is-animating">{flip.isAnimating() ? 'true' : 'false'}</span>
        </div>
      </div>

      {/* Sortable list with dropzone (items removed during drag, gap inserted) */}
      <div
        ref={containerRef}
        data-testid="overlay-list"
        style={{
          position: 'relative',
          display: 'flex',
          'flex-direction': 'column',
          gap: '4px',
          width: '300px',
          padding: '8px',
          border: '1px solid #444',
          'border-radius': '8px'
        }}
      >
        <For each={dropzone.displayKeys()}>
          {(key) => {
            if (key === GAP_KEY) {
              return (
                <div
                  data-testid="gap-placeholder"
                  ref={(el) => itemRefs.set(GAP_KEY, el)}
                  style={{
                    height: `${gapHeight()}px`,
                    border: '1px dashed #60a5fa',
                    'border-radius': '6px',
                    background: 'rgba(96, 165, 250, 0.1)'
                  }}
                />
              );
            }
            const item = itemMap().get(key);
            if (!item) return null;
            return (
              <div
                data-item-id={item.id}
                ref={(el) => itemRefs.set(item.id, el)}
                onPointerDown={(ev) => handlePointerDown(item.id, ev)}
                style={{
                  padding: '12px 16px',
                  background: item.color,
                  'border-radius': '6px',
                  color: 'white',
                  'font-weight': 'bold',
                  cursor: 'grab',
                  'user-select': 'none',
                  'touch-action': 'none'
                }}
              >
                {item.label}
              </div>
            );
          }}
        </For>
      </div>

      {/* Drag overlay — the floating ghost that follows the pointer */}
      <Show when={overlay.active()}>
        <div
          data-testid="drag-overlay"
          style={{
            position: 'fixed',
            left: `${overlay.position().x}px`,
            top: `${overlay.position().y}px`,
            width: `${overlay.size().x}px`,
            'z-index': 10000,
            'pointer-events': 'none'
          }}
        >
          {(() => {
            const id = draggedIds()[0];
            const item = id ? itemMap().get(id) : undefined;
            return item ? (
              <div
                data-testid="overlay-content"
                style={{
                  padding: '12px 16px',
                  background: item.color,
                  'border-radius': '6px',
                  color: 'white',
                  'font-weight': 'bold',
                  'box-shadow': '0 8px 32px rgba(0,0,0,0.4)',
                  'user-select': 'none'
                }}
              >
                {item.label}
              </div>
            ) : null;
          })()}
        </div>
      </Show>

      <div data-testid="item-order" style={{ 'margin-top': '8px', 'font-size': '12px' }}>
        {items()
          .map((i) => i.id)
          .join(',')}
      </div>
    </div>
  );
}
