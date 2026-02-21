// ============================================================================
// MARK: Demo Data
// ============================================================================

export type DemoItem = {
  id: string;
  label: string;
  color: string;
};

export function createDemoItems(): DemoItem[] {
  return [
    { id: '1', label: 'Item 1', color: '#e74c3c' },
    { id: '2', label: 'Item 2', color: '#3498db' },
    { id: '3', label: 'Item 3', color: '#2ecc71' },
    { id: '4', label: 'Item 4', color: '#f39c12' },
    { id: '5', label: 'Item 5', color: '#9b59b6' },
    { id: '6', label: 'Item 6', color: '#1abc9c' },
    { id: '7', label: 'Item 7', color: '#e67e22' },
    { id: '8', label: 'Item 8', color: '#2980b9' }
  ];
}
