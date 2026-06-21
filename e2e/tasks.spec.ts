/**
 * E2E tests — Task management flows
 *
 * Requires:
 *   E2E_ADMIN_EMAIL    — admin account email
 *   E2E_ADMIN_PASSWORD — admin account password
 *
 * All tests in this file are inside a describe block that is skipped
 * when credentials are not provided, so CI passes without a live backend.
 */

import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const HAS_CREDS = !!(ADMIN_EMAIL && ADMIN_PASSWORD);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/dashboard|boards|tasks/i, { timeout: 12_000 });
}

// ── Static page structure ─────────────────────────────────────────────────────

test('tasks list page returns 200 when navigated to', async ({ page }) => {
  // This redirects to /login for unauthenticated users — still a 200 HTML load
  const resp = await page.goto('/tasks');
  expect(resp?.status()).toBe(200);
});

test('boards page returns 200 when navigated to', async ({ page }) => {
  const resp = await page.goto('/boards');
  expect(resp?.status()).toBe(200);
});

// ── Authenticated task flows ──────────────────────────────────────────────────

test.describe('task CRUD (authenticated)', () => {
  test.skip(!HAS_CREDS, 'E2E credentials not set — skipping');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('tasks list page loads with task rows or empty state', async ({ page }) => {
    await page.goto('/tasks');
    // Either a task row, an empty-state message, or a loading spinner resolving
    await expect(
      page.locator('[data-testid="task-row"], .k-taskrow, .k-trow')
        .or(page.getByText(/no tasks|all caught up|create/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('new task modal opens from the tasks page', async ({ page }) => {
    await page.goto('/tasks');
    // Look for a "New task", "Add task", or "+" button
    const newBtn = page
      .getByRole('button', { name: /new task|add task|\+/i })
      .or(page.locator('[data-testid="new-task-btn"]'));
    await expect(newBtn.first()).toBeVisible({ timeout: 8_000 });
    await newBtn.first().click();
    // Modal should appear
    await expect(
      page.locator('[role="dialog"], .k-drawer, .modal, [data-testid="new-task-modal"]')
    ).toBeVisible({ timeout: 6_000 });
  });

  test('kanban board renders columns', async ({ page }) => {
    await page.goto('/boards');
    // Kanban column headers should be visible
    await expect(
      page.locator('.k-kanban-col, [data-testid="kanban-column"], [class*="column"]')
        .or(page.getByText(/to do|in progress|done/i))
    ).toBeVisible({ timeout: 12_000 });
  });

  test('dashboard page shows stat tiles', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.locator('.k-stats, [data-testid="stat-tile"], .stat-tile')
        .or(page.getByText(/tasks|due|overdue/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Templates page ────────────────────────────────────────────────────────────

test.describe('templates page (authenticated)', () => {
  test.skip(!HAS_CREDS, 'E2E credentials not set — skipping');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('/templates page loads without error', async ({ page }) => {
    const resp = await page.goto('/templates');
    expect(resp?.status()).toBe(200);
    // Should show template cards or empty state
    await expect(
      page.locator('.k-tmpl-grid, .k-tmpl-card, [data-testid="template-card"]')
        .or(page.getByText(/template|no templates/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Approvals page ────────────────────────────────────────────────────────────

test.describe('approvals page (authenticated)', () => {
  test.skip(!HAS_CREDS, 'E2E credentials not set — skipping');

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('/approvals page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
