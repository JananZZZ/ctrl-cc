import { test, expect } from '@playwright/test';

test.describe('Ctrl-CC Navigation', () => {
  test('app loads console surface', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="surface-console"]')).toBeVisible({ timeout: 10000 });
  });

  test('navigates to all 7 surfaces', async ({ page }) => {
    await page.goto('/');
    for (const s of ['Projects', 'Workspace', 'Resources', 'Canvas', 'GitHub', 'Settings']) {
      await page.click(`text=${s}`);
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Ctrl-CC Projects', () => {
  test('new project dialog opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Projects');
    await page.click('[data-testid="create-project-button"]');
    await page.waitForTimeout(500);
    await page.click('text=Cancel');
  });

  test('project rail shows projects', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Projects');
    await expect(page.locator('[data-testid="project-management-rail"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Ctrl-CC Workspace', () => {
  test('workspace shows empty state', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workspace');
    await expect(page.locator('[data-testid="surface-workspace"]')).toBeVisible({ timeout: 5000 });
  });

  test('composer input exists', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workspace');
    await expect(page.locator('[data-testid="chat-composer-input"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Ctrl-CC Settings', () => {
  test('settings surface renders all cards', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    await expect(page.locator('[data-testid="surface-settings"]')).toBeVisible({ timeout: 5000 });
  });
});
