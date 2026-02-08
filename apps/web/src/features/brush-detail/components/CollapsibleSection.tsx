import { Collapsible } from '@kobalte/core/collapsible';
import { createSignal, Show } from 'solid-js';

export function CollapsibleSection(props: {
  id: string;
  title: string;
  children: any;
  enabled?: boolean;
  onToggleEnabled?: (v: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? true);

  return (
    <div id={`section-${props.id}`} class="bg-ps-bg-dark border-ps-border overflow-hidden rounded-lg border">
      <Collapsible open={isOpen()} onOpenChange={setIsOpen}>
        <Collapsible.Trigger class="text-ps-text-bright hover:bg-ps-bg-light/50 flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
          <div class="flex items-center gap-3">
            <Show when={props.onToggleEnabled !== undefined}>
              <input
                type="checkbox"
                checked={props.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  props.onToggleEnabled?.(e.currentTarget.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                class="border-ps-border bg-ps-bg-dark checked:bg-ps-accent checked:border-ps-accent h-4 w-4 rounded"
              />
            </Show>
            <span class={props.onToggleEnabled !== undefined && !props.enabled ? 'opacity-50' : ''}>{props.title}</span>
          </div>
          <svg
            class={`h-4 w-4 transition-transform duration-200 ${isOpen() ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </Collapsible.Trigger>
        <Collapsible.Content class="border-ps-border border-t px-4 py-3">
          <div class={props.onToggleEnabled !== undefined && !props.enabled ? 'pointer-events-none opacity-50' : ''}>
            {props.children}
          </div>
        </Collapsible.Content>
      </Collapsible>
    </div>
  );
}
