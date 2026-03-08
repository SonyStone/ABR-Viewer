# Project Coding Guidelines

## Working Style

- Assume the dev server is already running so no need to start it manually.
- The project is in active development, not production, so making direct code changes is fine.

## Stack

- SolidJS + Solid Primitives + Tailwind CSS
- Vite
- TypeScript

## Coding Conventions

- Use `PointerEvent` instead of `MouseEvent` or `TouchEvent`; use `pointerType` when input type matters.
- In Solid lifecycle-managed code, prefer `@solid-primitives/event-listener` over manual `addEventListener`/`removeEventListener`.
  Use raw listeners only when there is no appropriate Solid lifecycle/context for cleanup.
- Use `type` instead of `interface`.
- Prefer immutable shapes: `ReadonlyArray<T>`, `Readonly<T>`, readonly tuples, and `as const` where appropriate.
- Use `MaybeAccessor<T>` from `@solid-primitives/utils` for values that may be static or reactive.
- Always use curly braces for control flow and One True Brace Style (1TBS).

## Type Patterns

- Prefer inferred aliases like `Parameters<typeof fn>` and `ReturnType<typeof fn>` over manually duplicated types.
- Prefer inline type declarations on function signatures for function-specific options/props.
- If a named alias is still useful, derive it from the function, e.g. `Parameters<typeof fn>[0]`.
- Avoid creating one-off `*Types.ts` files for a single function or primitive.
- Create a dedicated type+utility module only when multiple modules genuinely share both the type and its helpers.

## File Structure

Organize files top-to-bottom by importance so the public API is visible first.

1. **Types** — exported reusable types
2. **Main Component(s)** — primary exports
3. **Sub-Components** — internal building blocks
4. **Helper Functions** — lower-level implementation details

Function-specific option types should usually stay inline on the function signature.
The **Types** section is for exported reusable types, not every local options object.

## Component Structure

- Keep components small and single-purpose.
- Extract repeated patterns and complex JSX into focused sub-components, preferably in the same file unless reuse justifies splitting.
