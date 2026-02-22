# @solid-primitives — Usage Guide for solid-dnd

> Which `@solid-primitives` packages to use, when to adopt them, and why some were intentionally skipped.

## Currently Used

| Package | Where | Purpose |
|---|---|---|
| `@solid-primitives/event-listener` | `createDragSensor` | Auto-cleaning `makeEventListener` for Escape key handler. Prevents memory leaks on component unmount. |
| `@solid-primitives/scheduled` | `ListDemo` (playground) | `throttle` on `onDragMove` insertion-point recalc — caps at ~60fps instead of firing on every `pointermove`. |
| `@solid-primitives/cursor` | `ListDemo` (playground) | `createBodyCursor` sets `grabbing` cursor on `<body>` while `isDragging()` is true. More reliable than CSS `:active` with `setPointerCapture`. |

---

## Adopt at Specific Milestones

### M5 — `createNestable`

#### `@solid-primitives/resize-observer`

**What:** `createResizeObserver`, `createWindowSize`, `createElementSize`

**Why:** Nested containers may resize (accordion expand, sidebar toggle). Cached bounding rects become stale. Use `createResizeObserver` to invalidate rect caches when container dimensions change.

```ts
import { createResizeObserver } from '@solid-primitives/resize-observer';

createResizeObserver(containerEl, (entry) => {
  invalidateRects(containerKey);
});
```

### M7 — `createAutoScroll`

#### `@solid-primitives/scroll`

**What:** `createScrollPosition`, `useWindowScrollPosition`

**Why:** Auto-scroll needs to know current scroll offset to compute pointer-relative-to-container positions. `createScrollPosition` provides a reactive `{ x, y }` signal that updates on scroll.

```ts
import { createScrollPosition } from '@solid-primitives/scroll';

const scroll = createScrollPosition(containerEl);
// scroll.x, scroll.y are reactive
```

### M8 — `SortableList` Component

#### `@solid-primitives/context`

**What:** `createContextProvider`, `MultiProvider`

**Why:** The `SortableList` component needs to pass DnD state (drag sensor, selection, sortable) to child `SortableItem` components without prop drilling. `createContextProvider` provides better type inference than raw `createContext`.

```ts
import { createContextProvider } from '@solid-primitives/context';

const [SortableProvider, useSortable] = createContextProvider((props) => {
  const sensor = createDragSensor({ ... });
  const selection = createSelection({ ... });
  return { sensor, selection, ... };
});
```

#### `@solid-primitives/refs`

**What:** `mergeRefs`, `resolveElements`, `resolveFirst`

**Why:** `SortableList` needs a ref to each item's DOM element for measuring rects. But consumers may also want their own ref. `mergeRefs` composes multiple ref callbacks.

```tsx
import { mergeRefs } from '@solid-primitives/refs';

// Inside SortableItem:
<div ref={mergeRefs(props.ref, (el) => itemRefs.set(key, el))} />
```

### M10 — Accessibility

#### `@solid-primitives/keyboard`

**What:** `useKeyDownList`, `useCurrentlyHeldKey`, `createKeyHold`, `createShortcut`

**Why:** Keyboard-driven DnD needs: Space to grab, Arrow keys to move, Enter to drop, Escape to cancel. `createShortcut` registers key combos with auto-cleanup. `useCurrentlyHeldKey` helps detect modifier state for copy-vs-move.

```ts
import { createShortcut } from '@solid-primitives/keyboard';

createShortcut(['Space'], () => toggleGrab());
createShortcut(['ArrowDown'], () => moveDown());
createShortcut(['Escape'], () => cancelDrag());
```

#### `@solid-primitives/active-element`

**What:** `createActiveElement`, `createFocusSignal`

**Why:** Keyboard DnD requires roving tabindex and focus management. `createActiveElement` tracks which element has focus reactively, useful for knowing which item receives keyboard commands.

---

## Considered and Intentionally Skipped

### `@solid-primitives/set` / `@solid-primitives/map`

**What:** `ReactiveSet`, `ReactiveMap` — Reactive data structures with per-key granular tracking.

**Why skipped:** Our usage patterns are bulk-replace, not per-key:
- `draggedIds` — set all-at-once on drag start, cleared all-at-once on end. Never add/remove individually.
- `selected` in `createSelection` — replaced as a whole array on every click. The derived `selectedSet` is a `createMemo(() => new Set(...))` which is already optimal.
- `itemRefs` (`new Map<string, HTMLElement>`) — written in JSX `ref={}` callbacks, read inside event handlers. No SolidJS reactivity needed; reads happen outside tracked computations.

`ReactiveSet`/`ReactiveMap` add per-mutation signal overhead that would be wasted on our patterns. Use them only if a future feature needs "react when item X is added/removed from the set."

### `@solid-primitives/state-machine`

**What:** `createMachine` — Finite state machine primitive.

**Why skipped:** Our drag sensor is a 3-state machine (`idle → tracking → dragging`) implemented with two booleans. The formal FSM primitive adds abstraction without benefit at this scale. Reconsider if the state space grows significantly (e.g., adding `animating`, `auto-scrolling`, `keyboard-dragging` states).

### `@solid-primitives/spring` / `@solid-primitives/tween`

**What:** Spring physics interpolation / numeric tweening.

**Why skipped:** Our FLIP animations use the Web Animations API, which runs on the compositor thread (GPU-accelerated, doesn't block JS). Springs and tweens run in JS on the main thread at 60fps via `requestAnimationFrame`, which is strictly worse for layout animations. Could be useful for a future drag overlay "snap-back" effect, but not for list reordering.

### `@solid-primitives/static-store`

**What:** `createStaticStore` — Lightweight reactive objects with static keys (no Proxy).

**Why skipped:** Our `Vec2` is an immutable `{ x, y }` value type. We intentionally create a new object per frame (`Vec2.of(x, y)`) so that SolidJS signal comparison detects changes. Wrapping it in a mutable store would fight this design. `createSignal<Vec2>` is the right choice.

### `@solid-primitives/bounds`

**What:** `createElementBounds` — Reactive element bounds tracking via ResizeObserver + scroll + MutationObserver.

**Why skipped:** This is "always-on" tracking — it watches every scroll/resize/mutation to keep bounds fresh. Our `getRect()` approach measures on-demand during drag, which is much cheaper. We only need rects during the ~500ms of an active drag, not 100% of the time. Use `resize-observer` (above) only for invalidation, not continuous tracking.

### `@solid-primitives/pointer`

**What:** `createPointerListeners`, `createPerPointerListeners`, `createPointerPosition`

**Why skipped:** Our `createDragSensor` already handles pointer events directly with `setPointerCapture` — a more specialized pattern than what this package provides. The pointer primitive is designed for "track all active pointers on screen" which is broader than we need.

### `@solid-primitives/transition-group`

**What:** `createListTransition`, `createSwitchTransition`

**Why skipped:** `createListTransition` animates enter/exit of list items, but our reorder animation is a FLIP (same elements, new positions). The transition-group approach would require removing and re-adding elements, which is a different paradigm. Our `createFlip` is more appropriate for same-element positional animation.

### `@solid-primitives/event-bus`

**What:** `createEventBus`, `createEmitter`, `createEventHub`

**Why skipped:** Our primitives use direct callback options (`onDragStart`, `onSelectionChange`, etc.) which is simpler and more type-safe than a pubsub pattern. The callback pattern also composes better with SolidJS's ownership model (auto-cleanup). Reconsider if cross-component DnD events become complex.

### `@solid-primitives/mutation-observer`

**What:** `createMutationObserver`

**Why skipped:** We don't need to watch for external DOM mutations. Our items are controlled by SolidJS signals — when items change, we know because we changed them. MutationObserver would be needed if external code modified the DOM behind our back.

---

## Quick Reference: Full Catalog by Category

> Packages with **no DnD relevance** included for completeness.

### Inputs
`active-element` · `autofocus` · `input-mask` · `keyboard` · `mouse` · `pointer` · `scroll` · `selection`

### Display & Media
`audio` · `bounds` · `devices` · `filesystem` · `idle` · `intersection-observer` · `media` · `page-visibility` · `resize-observer` · `styles`

### Browser APIs
`broadcast-channel` · `clipboard` · `event-listener` · `event-props` · `fullscreen` · `geolocation` · `mutation-observer` · `permission` · `storage` · `timer` · `upload` · `workers`

### Network
`connectivity` · `cookies` · `fetch` · `graphql` · `stream` · `websocket`

### Control Flow
`context` · `jsx-tokenizer` · `keyed` · `list` · `match` · `range` · `refs`

### Utilities
`controlled-props` · `cursor` · `date` · `event-bus` · `event-dispatcher` · `flux-store` · `history` · `i18n` · `platform` · `promise` · `props` · `scheduled` · `script-loader` · `share`

### Reactivity
`db-store` · `deep` · `destructure` · `immutable` · `lifecycle` · `map` · `memo` · `mutable` · `resource` · `rootless` · `set` · `signal-builders` · `state-machine` · `static-store` · `trigger`

### Animation
`presence` · `raf` · `spring` · `transition-group` · `tween`

### UI Patterns
`marker` · `masonry` · `pagination` · `virtual`
