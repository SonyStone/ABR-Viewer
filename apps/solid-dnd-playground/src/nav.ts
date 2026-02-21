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
    title: 'Containers',
    items: [{ label: 'Nested', href: '/nested' }]
  }
];
