# @solid-primitives — Ecosystem Reference

> Complete catalog of `@solid-primitives` packages for SolidJS projects.
> Use this document to find the right reactive primitive for any use case.

---

## Inputs

### `@solid-primitives/active-element`

Track which DOM element currently has focus. `createActiveElement` returns a reactive signal of the focused element. `createFocusSignal` returns a boolean for a specific element.

### `@solid-primitives/autofocus`

Automatically focus elements on mount. `autofocus` directive and `createAutofocus` primitive.

### `@solid-primitives/input-mask`

Input masking for text fields. `createInputMask` applies formatting patterns (phone numbers, dates, etc.) to input elements.

### `@solid-primitives/keyboard`

Reactive keyboard input. `useKeyDownList` tracks all currently held keys. `useCurrentlyHeldKey` returns a single key signal. `createKeyHold` detects long-press of a key. `createShortcut` registers key combos with auto-cleanup.

### `@solid-primitives/mouse`

Track mouse/touch cursor position reactively. `createMousePosition` for global position. `createPositionToElement` for position relative to a specific element. `getPositionInElement` for normalized 0–1 coordinates within an element.

### `@solid-primitives/pointer`

Unified pointer event handling (mouse + touch + pen). `createPointerListeners` attaches pointer event handlers. `createPerPointerListeners` tracks individual pointers from down→up. `createPointerPosition` for reactive pointer position. `pointerHover` directive for hover detection that works across input types.

### `@solid-primitives/scroll`

Reactive scroll position tracking. `createScrollPosition` returns `{ x, y }` for a scrollable element. `useWindowScrollPosition` for the window.

### `@solid-primitives/selection`

Track the current text selection in the document reactively. Not related to item/list selection — this is about `window.getSelection()`.

---

## Display & Media

### `@solid-primitives/bounds`

Reactive element bounds (position + size) on screen. `createElementBounds` auto-updates on scroll, resize, and DOM mutation. Supports throttling. Returns `{ top, left, right, bottom, width, height }`.

### `@solid-primitives/resize-observer`

Reactive ResizeObserver wrappers. `createResizeObserver` calls back when element dimensions change. `createWindowSize` and `createElementSize` return reactive `{ width, height }`.

### `@solid-primitives/intersection-observer`

Reactive IntersectionObserver wrappers. `createIntersectionObserver` tracks when elements enter/leave a root viewport. `createVisibilityObserver` returns a boolean signal per element.

### `@solid-primitives/media`

Reactive media queries and breakpoints. `createMediaQuery` returns a boolean signal for a query. `createBreakpoints` maps named breakpoints to reactive signals. `usePrefersDark` detects dark mode preference.

### `@solid-primitives/page-visibility`

Track whether the page/tab is visible or hidden. `createPageVisibility` returns a reactive signal.

### `@solid-primitives/idle`

Detect user idle state. `createIdleTimer` fires after configurable inactivity.

### `@solid-primitives/styles`

Track computed CSS values reactively. `createRemSize` returns the current `rem` size in pixels.

### `@solid-primitives/audio`

Reactive audio playback. `makeAudio`, `makeAudioPlayer`, `createAudio` for playing audio with reactive state (playing, currentTime, duration, etc.).

### `@solid-primitives/devices`

Access hardware devices. `createDevices` lists media devices. Also provides `createAccelerometer`, `createGyroscope` for sensor data.

### `@solid-primitives/filesystem`

File system access API wrappers. `createFileSystem` and variants for reading/writing files via the browser File System Access API.

---

## Browser APIs

### `@solid-primitives/event-listener`

Comprehensive reactive event listener management with automatic cleanup on component unmount.

- `createEventListener` — Reactive: re-attaches when target/event signal changes.
- `makeEventListener` — Non-reactive: attaches once, cleans up on dispose.
- `createEventSignal` — Returns a signal of the latest event.
- `createEventListenerMap` — Attach multiple events at once.
- `makeEventListenerStack` — Push/pop listeners.
- `WindowEventListener` / `DocumentEventListener` — JSX components for declarative listeners.
- `preventDefault`, `stopPropagation`, `stopImmediatePropagation` — Event modifier helpers.

### `@solid-primitives/event-props`

`createEventProps` — Create event handler props objects for composable component APIs. Useful when building wrapper components that need to forward event handlers.

### `@solid-primitives/mutation-observer`

Reactive MutationObserver wrapper. `createMutationObserver` watches for DOM changes (child additions, attribute changes, text content changes).

### `@solid-primitives/clipboard`

Clipboard read/write. `copyClipboard` for quick copy. `writeClipboard` for the async Clipboard API. `createClipboard` for reactive clipboard access.

### `@solid-primitives/fullscreen`

Fullscreen API wrapper. `createFullscreen` toggles fullscreen mode on an element with a reactive signal.

### `@solid-primitives/permission`

Track browser permissions reactively. `createPermission` returns a signal for a permission state (granted/denied/prompt).

### `@solid-primitives/storage`

Persistent reactive storage. `makePersisted` wraps any signal to sync with localStorage, sessionStorage, or cookies. `cookieStorage` adapter for cookie-based persistence. `storageSync` for cross-tab sync.

### `@solid-primitives/timer`

Reactive timer/interval primitives with auto-cleanup. `makeTimer` for one-shot or repeating timers. `createTimer` for reactive timer signals. `createPolled` for periodic polling. `createIntervalCounter` for incrementing counters.

### `@solid-primitives/upload`

File upload with drop zones. `createFileUploader` for file input handling. `createDropzone` for file drag-and-drop.

### `@solid-primitives/workers`

Web Worker primitives. `createWorker` for running code in a worker. `createWorkerPool` for parallel processing. `createSignaledWorker` for reactive worker communication.

### `@solid-primitives/broadcast-channel`

Cross-tab communication via BroadcastChannel API. `makeBroadcastChannel` and `createBroadcastChannel` for sending/receiving messages between browser tabs.

### `@solid-primitives/geolocation`

GPS/location tracking. `createGeolocation` for one-time position. `createGeolocationWatcher` for continuous tracking.

### `@solid-primitives/script-loader`

Dynamic script loading. `createScriptLoader` loads external scripts and provides a reactive loading state.

### `@solid-primitives/share`

Web Share API. `createWebShare` for native sharing. `createSocialShare` for social media share links.

---

## Network

### `@solid-primitives/connectivity`

Track online/offline status. `createConnectivitySignal` returns a boolean signal.

### `@solid-primitives/cookies`

Cookie management. `createServerCookie` for SSR. `getCookiesString` for reading cookies.

### `@solid-primitives/fetch`

Reactive fetch wrapper. `createFetch` provides reactive fetch with caching, refetching, and abort support.

### `@solid-primitives/graphql`

GraphQL client. `createGraphQLClient` for reactive GraphQL queries.

### `@solid-primitives/stream`

Media streams. `createStream` for camera/microphone access. `createAmplitudeStream` for audio levels. `createScreen` for screen capture.

### `@solid-primitives/websocket`

WebSocket primitives. `makeWS` / `createWS` for basic connections. `makeReconnectingWS` for auto-reconnect. `createWSState` for reactive connection state.

---

## Control Flow

### `@solid-primitives/context`

Simplified SolidJS Context API with better type inference. `createContextProvider` returns a `[Provider, useContext]` tuple. `MultiProvider` nests multiple providers without indentation hell.

### `@solid-primitives/jsx-tokenizer`

JSX children tokenization for building composable component APIs. `createTokenizer`, `createToken`, `resolveTokens` — parse JSX children into typed tokens for custom rendering logic.

### `@solid-primitives/keyed`

Keyed control flow components. `keyArray` and `<Key>` — like `<For>` but keyed by value reference rather than index. `<Entries>`, `<MapEntries>`, `<SetValues>` for iterating reactive collections.

### `@solid-primitives/list`

Non-keyed list rendering. `listArray` and `<List>` — like `<For>` but optimized for cases where items don't have stable keys.

### `@solid-primitives/match`

Pattern matching control flow. `<MatchTag>`, `<MatchValue>` — render based on discriminated unions or value matching.

### `@solid-primitives/range`

Range-based iteration. `repeat`, `mapRange`, `indexRange` — iterate over numeric ranges. `<Repeat>`, `<Range>`, `<IndexRange>` — JSX components for range rendering.

### `@solid-primitives/refs`

Manage JSX element references. `mergeRefs` composes multiple ref callbacks (essential when both library and consumer need a ref). `resolveElements` / `resolveFirst` — resolve nested JSX children to actual DOM elements. `<Ref>` / `<Refs>` — declarative ref components.

---

## Utilities

### `@solid-primitives/controlled-props`

Create controlled/uncontrolled prop patterns. `createControlledProp` — like React's controlled vs uncontrolled input pattern for SolidJS components.

### `@solid-primitives/cursor`

Reactively set CSS cursor. `createElementCursor` sets cursor on a specific element. `createBodyCursor` sets it on `<body>`. Pass a reactive accessor that returns the cursor string or `null`.

### `@solid-primitives/date`

Reactive date/time utilities. `createDate` for reactive Date objects. `createDateNow` for current time with configurable interval. `createTimeAgo` for relative time strings. `createCountdown` for countdowns.

### `@solid-primitives/event-bus`

Pubsub/event emitter primitives. `createEventBus` for typed event channels. `createEmitter` for multi-event emitters. `createEventHub` for namespaced event systems. `createEventStack` for event queues.

### `@solid-primitives/event-dispatcher`

DOM CustomEvent dispatching. `createEventDispatcher` — dispatch typed custom events on DOM elements.

### `@solid-primitives/flux-store`

Redux-like flux state management. `createFluxStore` for stores with reducers. `createActions` for action creators.

### `@solid-primitives/history`

Undo/redo history tracking. `createUndoHistory` wraps a signal with undo/redo capabilities, configurable history depth.

### `@solid-primitives/i18n`

Internationalization. `translator`, `scopedTranslator`, `chainedTranslator` — reactive translation functions with template resolution.

### `@solid-primitives/platform`

Platform detection. Variables for detecting browser, OS, touch support, etc. Useful for adapting behavior per platform.

### `@solid-primitives/promise`

Promise utilities. `promiseTimeout` for timed promises. `raceTimeout` for timeout racing. `until` for waiting on a reactive condition.

### `@solid-primitives/props`

Component prop utilities. `combineProps` merges multiple props objects (handles event handlers, class, style merging). `filterProps` picks/omits props.

### `@solid-primitives/scheduled`

Scheduled/throttled/debounced callbacks.

- `throttle(fn, ms)` — At most once per interval.
- `debounce(fn, ms)` — Delay until activity stops.
- `scheduleIdle(fn)` — Run during idle periods.
- `leading(fn, ms)` — Fire immediately, then throttle.
- `leadingAndTrailing(fn, ms)` — Fire on both edges.
- `createScheduled(fn)` — Reactive scheduled primitive.

---

## Reactivity

### `@solid-primitives/set`

Reactive `Set` and `WeakSet`. `ReactiveSet` — reads (`.has()`, `.size`, iteration) are tracked as signals. Mutations (`.add()`, `.delete()`) trigger updates. Provides granular per-key reactivity.

### `@solid-primitives/map`

Reactive `Map` and `WeakMap`. `ReactiveMap` — same pattern as ReactiveSet. `.get(key)` is tracked per-key. `.set(key, value)` only notifies dependents of that key.

### `@solid-primitives/memo`

Extended memo primitives.

- `createWritableMemo` — A computed value that can be manually overridden.
- `createLazyMemo` — Only computes when actually read (not eagerly).
- `createPureReaction` — Side-effect-free reaction that returns tracked dependencies.
- `createMemoCache` — Keyed memo cache with automatic invalidation.
- `createReducer` — Redux-style reducer pattern as a signal.
- `createLatest` / `createLatestMany` — Track the most recent non-undefined signal value.

### `@solid-primitives/signal-builders`

Chainable composable signal calculations. Array operations (push, filter, sort, map), object operations (merge, pick), number operations (clamp, lerp), string operations (concat, template).

### `@solid-primitives/state-machine`

Finite state machine primitive. `createMachine` — define states, transitions, and guards. Returns reactive `state` signal and `send` function.

### `@solid-primitives/static-store`

Lightweight reactive objects with static (known-at-creation-time) keys. `createStaticStore` — no Proxy overhead, each key is an independent signal. `createDerivedStaticStore` for computed static stores. More performant than `createStore` for small objects with fixed shape.

### `@solid-primitives/trigger`

Manual trigger signals. `createTrigger` — a signal you explicitly `track()` and `dirty()`. `createTriggerCache` — keyed triggers for fine-grained invalidation (e.g., invalidate recalculation for a specific item without affecting others).

### `@solid-primitives/deep`

Deep tracking of nested stores. `trackDeep` deeply tracks all nested properties of a store. `trackStore` is the same. `captureStoreUpdates` returns a diff of what changed in a store update.

### `@solid-primitives/destructure`

Destructure reactive objects into individual signals. `destructure({ x, y })` returns `{ x: Accessor, y: Accessor }` where each property is independently tracked.

### `@solid-primitives/immutable`

Create deeply immutable reactive objects. `createImmutable` — like `createStore` but prevents mutations, useful for passing read-only state to children.

### `@solid-primitives/mutable`

Mutable reactive objects (like Vue's reactivity model). `createMutable` — direct property assignment triggers reactive updates.

### `@solid-primitives/lifecycle`

Component lifecycle helpers. `createIsMounted` — boolean signal for mount state. `isHydrated` — detect SSR hydration. `onElementConnect` — callback when element is actually connected to DOM.

### `@solid-primitives/rootless`

Manage reactive roots outside components. `createSubRoot` for nested disposal. `createCallback` for owner-less callbacks. `createSharedRoot` for singleton reactive computations. `createRootPool` for pooling roots.

### `@solid-primitives/resource`

Async resource utilities. `createAggregated` for combining resources. `createDeepSignal` for deeply reactive async data. `makeAbortable` for cancellable async operations. `makeRetrying` for retry logic.

### `@solid-primitives/db-store`

Database-backed reactive stores. `createDbStore` syncs a SolidJS store with a database (Supabase adapter included).

---

## Animation

### `@solid-primitives/raf`

Reactive `requestAnimationFrame` loop. `createRAF` returns `[running, start, stop]` for a frame loop. `createMs` returns a reactive millisecond counter. `targetFPS` wraps a callback with FPS limiting.

### `@solid-primitives/spring`

Spring physics interpolation. `createSpring` smoothly interpolates numbers, arrays, or objects using configurable stiffness/damping/precision. `createDerivedSpring` for computed springs.

### `@solid-primitives/tween`

Smooth numeric tweening. `createTween` transitions a numeric signal from old→new value over configurable duration with easing functions, using `requestAnimationFrame`.

### `@solid-primitives/transition-group`

Transition effects for element lists. `createListTransition` animates enter/move/exit of list items with callbacks for each phase. `createSwitchTransition` for switching between single elements.

### `@solid-primitives/presence`

Animate element enter/exit. `createPresence` tracks mount lifecycle: `isMounted`, `isVisible`, `isEntering`, `isExiting`. Keeps element in DOM during exit animation.

---

## UI Patterns

### `@solid-primitives/virtual`

Virtual scrolling for large lists. `createVirtualList` and `<VirtualList>` — only renders visible items plus a buffer. Provides reactive `items`, `scrollTo`, and container props.

### `@solid-primitives/masonry`

Masonry layout primitive. `createMasonry` computes masonry column assignments for items with variable heights.

### `@solid-primitives/pagination`

Pagination and infinite scroll. `createPagination` for page-based navigation. `createInfiniteScroll` for load-on-scroll patterns.

### `@solid-primitives/marker`

Element marking/highlighting. `createMarker` for annotating DOM elements.
