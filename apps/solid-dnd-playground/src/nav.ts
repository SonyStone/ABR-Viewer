// ============================================================================
// MARK: Navigation Structure
// ============================================================================

export type NavItem = {
  label: string;
  href: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: 'Draggable',
    items: [{ label: 'Sensor', href: '/' }]
  },
  {
    title: 'Sortable',
    items: [
      { label: 'Vertical list', href: '/list' },
      { label: 'Grid', href: '/grid' }
    ]
  },
  {
    title: 'Sortable + Overlay',
    items: [
      { label: 'List overlay', href: '/list-overlay' },
      { label: 'Grid overlay', href: '/grid-overlay' }
    ]
  },
  {
    title: 'Containers',
    items: [
      { label: 'Nested', href: '/nested' },
      { label: 'Nested overlay', href: '/nested-overlay' }
    ]
  }
];
