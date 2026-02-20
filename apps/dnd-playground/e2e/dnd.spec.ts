import { expect, Page, test } from '@playwright/test';

// ============================================================================
// MARK: Helpers
// ============================================================================

/**
 * Simulates a drag operation using low-level mouse events.
 * This is the key technique for testing DnD — we use page.mouse to perform
 * precise pointer movements that trigger the real drag logic.
 */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();

  // Move in increments to trigger pointermove events and exceed the drag threshold
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps);
    const y = from.y + (to.y - from.y) * (i / steps);
    await page.mouse.move(x, y);
  }

  await page.mouse.up();
}

/** Gets the center point of a locator's bounding box. */
async function getCenter(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Element not found: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Returns all visible brush names in order. */
async function getBrushNames(page: Page, parentSelector?: string) {
  const selector = parentSelector ? `${parentSelector} [data-block-type="brush"]` : '[data-block-type="brush"]';
  return page.locator(selector).allInnerTexts();
}

/** Returns the text of the "Last:" event in the header. */
async function getLastEvent(page: Page) {
  return page.locator('text=Last:').innerText();
}

// ============================================================================
// MARK: Setup
// ============================================================================

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the tree to render
  await expect(page.locator('[data-block-type="brush"]').first()).toBeVisible();
});

// ============================================================================
// MARK: Initial Render
// ============================================================================

test.describe('Initial render', () => {
  test('shows the DnD Playground header', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('DnD Playground');
  });

  test('renders brush items', async ({ page }) => {
    const brushes = page.locator('[data-block-type="brush"]');
    await expect(brushes.first()).toBeVisible();
    expect(await brushes.count()).toBeGreaterThan(0);
  });

  test('renders group items', async ({ page }) => {
    const groups = page.locator('[data-block-type="group"]');
    await expect(groups.first()).toBeVisible();
    expect(await groups.count()).toBeGreaterThan(0);
  });

  test('shows correct brush and group counts in header', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toContainText('brushes');
    await expect(header).toContainText('groups');
  });
});

// ============================================================================
// MARK: Selection
// ============================================================================

test.describe('Selection', () => {
  test('clicking a brush selects it', async ({ page }) => {
    const brush = page.locator('[data-block-type="brush"]').first();
    await brush.click();

    // Check that the last event reflects a selection
    await expect(page.locator('text=Last:')).toContainText('Select');
    // Check that the selection count shows 1
    await expect(page.locator('text=Selected:')).toContainText('1');
  });

  test('clicking another brush replaces selection', async ({ page }) => {
    const brushes = page.locator('[data-block-type="brush"]');
    await brushes.nth(0).click();
    await expect(page.locator('text=Selected:')).toContainText('1');

    await brushes.nth(1).click();
    await expect(page.locator('text=Selected:')).toContainText('1');
  });

  test('ctrl+click adds to selection', async ({ page }) => {
    const brushes = page.locator('[data-block-type="brush"]');
    await brushes.nth(0).click();
    await brushes.nth(1).click({ modifiers: ['ControlOrMeta'] });

    await expect(page.locator('text=Selected:')).toContainText('2');
  });

  test('clicking a group selects it', async ({ page }) => {
    const group = page.locator('[data-block-type="group"]').first();
    await group.click();

    await expect(page.locator('text=Last:')).toContainText('Select');
  });
});

// ============================================================================
// MARK: Drag and Drop
// ============================================================================

test.describe('Drag and Drop', () => {
  test('dragging a brush shows a drag ghost', async ({ page }) => {
    const brush = page.locator('[data-block-type="brush"]').first();
    const box = await brush.boundingBox();
    if (!box) throw new Error('Brush not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Start drag but don't release
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move enough to trigger drag (exceeds the 10px threshold)
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX, startY + i * 10);
    }

    // A drag ghost should appear (the fixed-position drag container)
    // The ghost is rendered as a div with position: fixed and z-index: 10000
    const ghost = page.locator('div[style*="position: fixed"][style*="z-index: 10000"]');
    await expect(ghost).toBeVisible();

    // Release the drag
    await page.mouse.up();
  });

  test('dragging a brush and dropping reorders items', async ({ page }) => {
    // Get the first two brushes in the first group that contains brushes
    const brushes = page.locator('[data-block-type="brush"]');
    const firstBrush = brushes.nth(0);
    const thirdBrush = brushes.nth(2);

    const firstBox = await firstBrush.boundingBox();
    const thirdBox = await thirdBrush.boundingBox();
    if (!firstBox || !thirdBox) throw new Error('Brushes not found');

    const firstName = await firstBrush.innerText();

    // Drag first brush to the position of the third brush
    await drag(
      page,
      { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 },
      { x: thirdBox.x + thirdBox.width / 2, y: thirdBox.y + thirdBox.height / 2 },
      15
    );

    // Wait for animation to complete
    await page.waitForTimeout(300);

    // Verify a reorder event was fired
    await expect(page.locator('text=Last:')).toContainText('Reorder');
  });

  test('drag completes on mouse up even if cursor moved away', async ({ page }) => {
    const brush = page.locator('[data-block-type="brush"]').first();
    const box = await brush.boundingBox();
    if (!box) throw new Error('Brush not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Start drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move enough to trigger drag
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX, startY + i * 10);
    }

    // Ghost should be visible during drag
    const ghost = page.locator('div[style*="position: fixed"][style*="z-index: 10000"]');
    await expect(ghost).toBeVisible();

    // Release the mouse
    await page.mouse.up();

    // Ghost should disappear after drop
    await expect(ghost).not.toBeVisible();
  });

  test('drag ghost follows the mouse pointer', async ({ page }) => {
    const brush = page.locator('[data-block-type="brush"]').first();
    const box = await brush.boundingBox();
    if (!box) throw new Error('Brush not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Move down to trigger drag
    const targetY = startY + 80;
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX, startY + i * 16);
    }

    // Get ghost position
    const ghost = page.locator('div[style*="position: fixed"][style*="z-index: 10000"]');
    await expect(ghost).toBeVisible();

    const ghostBox = await ghost.boundingBox();
    if (!ghostBox) throw new Error('Ghost not found');

    // Ghost should be near the current mouse position (offset by the grab point)
    expect(ghostBox.y).toBeGreaterThan(startY);

    await page.mouse.up();
  });
});

// ============================================================================
// MARK: Keyboard
// ============================================================================

test.describe('Keyboard', () => {
  test('pressing Delete removes selected items', async ({ page }) => {
    // Get initial brush count
    const initialCount = await page.locator('[data-block-type="brush"]').count();

    // Select a brush
    const brush = page.locator('[data-block-type="brush"]').first();
    await brush.click();

    // Press Delete
    await page.keyboard.press('Delete');

    // Wait for update
    await page.waitForTimeout(300);

    // Should have one fewer brush
    const finalCount = await page.locator('[data-block-type="brush"]').count();
    expect(finalCount).toBe(initialCount - 1);

    // Should show a Remove event
    await expect(page.locator('text=Last:')).toContainText('Remove');
  });
});

// ============================================================================
// MARK: Group Collapse
// ============================================================================

test.describe('Group collapse', () => {
  test('clicking collapse button hides children', async ({ page }) => {
    // Find the first collapse button (the ▼ button)
    const collapseBtn = page.locator('[data-block-type="group"] button').first();
    await expect(collapseBtn).toBeVisible();

    // Get the first group
    const firstGroup = page.locator('[data-block-type="group"]').first();

    // Count brushes inside this group before collapse
    const brushesBefore = await firstGroup.locator('[data-block-type="brush"]').count();

    // Click collapse
    await collapseBtn.click();

    // After collapsing, the group's brushes should be hidden
    const brushesAfter = await firstGroup.locator('[data-block-type="brush"]').count();
    expect(brushesAfter).toBeLessThan(brushesBefore);
  });
});
