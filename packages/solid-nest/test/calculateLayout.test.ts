import { createRoot } from 'solid-js';
import { Container } from 'src/BlockTree';
import { calculateLayout } from 'src/calculateLayout';
import { createBlockItemId, ItemId } from 'src/Item';
import { BlockMeasurements } from 'src/measure';
import { VirtualTree } from 'src/virtual-tree';
import { describe, expect, it } from 'vitest';

// ============================================================================
// MARK: Test Helpers
// ============================================================================

type TestBlock = { key: string; tag?: string; containers?: Container<string, TestBlock>[] };

function block(key: string, tag?: string): TestBlock {
  return { key, tag };
}

function group(key: string, children: TestBlock[], accepts: string[] = []): TestBlock {
  const container: Container<string, TestBlock> = {
    key,
    spacing: 4,
    accepts,
    getBlocks: () => children
  };
  return { key, tag: 'group', containers: [container] };
}

function buildTree(rootChildren: TestBlock[], accepts: string[] = ['group', 'brush']): VirtualTree<string, TestBlock> {
  let tree!: VirtualTree<string, TestBlock>;

  createRoot((dispose) => {
    const root: Container<string, TestBlock> = {
      key: 'root',
      spacing: 4,
      accepts,
      getBlocks: () => rootChildren
    };

    const accessor = VirtualTree.create<string, TestBlock>(
      () => root,
      (b) => b.key,
      (b) => ({ tag: b.tag }),
      (b) => b.containers ?? []
    );

    tree = accessor();
    dispose();
  });

  return tree;
}

/**
 * Creates a simple measurement map where each block is 30px tall
 * and positioned at consecutive heights inside the root container.
 */
function createSimpleMeasurements(
  tree: VirtualTree<string, TestBlock>,
  blockHeight: number = 30,
  containerWidth: number = 200
): Map<ItemId, BlockMeasurements> {
  const measures = new Map<ItemId, BlockMeasurements>();

  // Root container measurement
  const rootChildren = tree.children(tree.root.id).filter((c) => c.kind === 'block');
  const spacing = tree.root.spacing;
  const totalHeight = rootChildren.length * blockHeight + (rootChildren.length - 1) * spacing;

  measures.set(tree.root.id, {
    container: new DOMRect(0, 0, containerWidth, totalHeight),
    children: rootChildren.map((child, i) => ({
      x: 0,
      y: i * (blockHeight + spacing),
      w: 0,
      id: child.id
    })),
    bottom: 0
  });

  // Each block measurement (flat, no nested containers)
  for (const child of rootChildren) {
    measures.set(child.id, {
      container: new DOMRect(0, 0, containerWidth, blockHeight),
      children: [],
      bottom: blockHeight
    });
  }

  return measures;
}

// ============================================================================
// MARK: calculateLayout
// ============================================================================

describe('calculateLayout', () => {
  it('computes layout rects for a flat list of blocks', () => {
    const tree = buildTree([block('a'), block('b'), block('c')]);
    const measures = createSimpleMeasurements(tree);
    const layout = calculateLayout(tree, (id) => measures.get(id));

    // Check that every block has a rect
    const rectA = layout.get(createBlockItemId('a'));
    const rectB = layout.get(createBlockItemId('b'));
    const rectC = layout.get(createBlockItemId('c'));

    expect(rectA).toBeDefined();
    expect(rectB).toBeDefined();
    expect(rectC).toBeDefined();

    // Blocks should be positioned vertically with spacing
    expect(rectA!.y).toBe(0);
    expect(rectB!.y).toBeGreaterThan(rectA!.y);
    expect(rectC!.y).toBeGreaterThan(rectB!.y);
  });

  it('includes the root container in the layout', () => {
    const tree = buildTree([block('a')]);
    const measures = createSimpleMeasurements(tree);
    const layout = calculateLayout(tree, (id) => measures.get(id));

    const rootRect = layout.get(tree.root.id);
    expect(rootRect).toBeDefined();
  });

  it('accounts for spacing between blocks', () => {
    const tree = buildTree([block('a'), block('b')]);
    const blockHeight = 30;
    const measures = createSimpleMeasurements(tree, blockHeight);
    const layout = calculateLayout(tree, (id) => measures.get(id));

    const rectA = layout.get(createBlockItemId('a'))!;
    const rectB = layout.get(createBlockItemId('b'))!;

    // B should start at A's bottom + spacing (4px)
    expect(rectB.y).toBe(rectA.y + blockHeight + 4);
  });

  it('returns an empty layout when the tree has no blocks', () => {
    const tree = buildTree([]);
    const measures = createSimpleMeasurements(tree);
    const layout = calculateLayout(tree, (id) => measures.get(id));

    // Should still have the root and placeholder
    expect(layout.size).toBeGreaterThan(0);
  });
});
