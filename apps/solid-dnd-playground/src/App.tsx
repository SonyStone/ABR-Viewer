import type { JSX } from 'solid-js';
import Sidebar from './components/Sidebar';

// ============================================================================
// MARK: App (root layout)
// ============================================================================

export default function App(props: { children?: JSX.Element }): JSX.Element {
  return (
    <div class="flex h-screen flex-col">
      {/* Header */}
      <header class="flex items-center gap-4 border-b border-white/10 bg-white/5 px-6 py-3">
        {/* Spacer for mobile hamburger */}
        <div class="w-8 md:hidden" />
        <h1 class="text-lg font-bold text-white">solid-dnd</h1>
        <span class="text-xs text-neutral-500">Playground</span>
      </header>

      {/* Body: sidebar + content */}
      <div class="flex min-h-0 flex-1">
        <Sidebar />

        <main class="flex-1 overflow-y-auto p-6">
          <div class="mx-auto max-w-2xl">{props.children}</div>
        </main>
      </div>
    </div>
  );
}
