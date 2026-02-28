# Project Coding Guidelines

## Dev Server

Assume that the dev server is always on and ask the user to check that the dev server is working properly.

The project is in active development and not in production, so you can freely make changes to the codebase.

## Framework

- **UI Framework**: SolidJS + Solid Primitives + Tailwind CSS
- **Build Tool**: Vite
- **Language**: TypeScript

## Event Listeners

- Use `@solid-primitives/event-listener` instead of manual `addEventListener`/`removeEventListener`.
  This provides automatic cleanup when the component unmounts, preventing memory leaks.

## Pointer Events

- Use `PointerEvent` instead of `MouseEvent` or `TouchEvent`.

Pointer Events provide a unified API for mouse, touch, and pen input. Use `pointerType` to differentiate input types when needed.

## TypeScript Conventions

- Use `type` instead of `interface` for type definitions.

- Use readonly arrays (`ReadonlyArray<T>`), readonly objects (`Readonly<T>`), readonly tuples (`readonly [T, U]`) and `as const` for props and state that should not be mutated, to prevent accidental mutations and improve type safety.

- Prefer inferred patterns like `Parameters<typeof fn>` / `ReturnType<typeof fn>` over separate type declarations — it's DRY, keeps docs with implementation, and shows the real shape on hover.

- Type + Utility Module Pattern
  When a type has associated utility functions, create a dedicated module file — not a const object.
  Benefits: function overloads, tree-shaking, clean `import * as X` usage.

- Use `MaybeAccessor<T>` from `@solid-primitives/utils` for props that can be static or reactive, to allow flexible usage without forcing the caller to wrap static values in a function.

### Component Structure

- **Refactor large components into smaller, focused sub-components.**
  Keep components small and single-purpose. Extract repeated patterns and complex JSX into separate components within the same file.

### File Organization (Newspaper Style, The Stepdown Rule)

**Organize files top-to-bottom by importance, like a newspaper article.**

The most important content (main exports) should be at the top, with supporting details (sub-components, helpers) at the bottom. Readers should understand the file's purpose without scrolling.

**Section order:**

1. **Types** - Exported types and interfaces
2. **Main Component(s)** - Primary exported components
3. **Sub-Components** - Internal components used by main
4. **Helper Functions** - Utility functions

This allows readers to quickly understand the file's API and main functionality before diving into implementation details.
