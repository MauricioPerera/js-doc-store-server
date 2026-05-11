const { test, expect } = require('@playwright/test');

const API_URL = 'https://doc-store-api-prod.rckflr.workers.dev';

test.describe('js-doc-store UI Tests', () => {
  test('Login page loads with all elements', async ({ page }) => {
    await page.goto(API_URL);

    // Check login screen exists
    const loginScreen = page.locator('#login-screen');
    await expect(loginScreen).toBeVisible();

    // Check form elements
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#btn-login')).toBeVisible();

    // Dashboard should be hidden
    const dashboardScreen = page.locator('#dashboard-screen');
    await expect(dashboardScreen).not.toBeVisible();
  });

  test('Login flow works and redirects to dashboard', async ({ page }) => {
    await page.goto(API_URL);

    // Fill credentials
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin123!');

    // Click login
    await page.click('#btn-login');

    // Wait for dashboard to appear
    await page.waitForSelector('#dashboard-screen.active', { timeout: 10000 });

    // Check token is saved
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Login screen should be hidden
    await expect(page.locator('#login-screen')).not.toBeVisible();

    // Dashboard should be visible
    await expect(page.locator('#dashboard-screen')).toBeVisible();
  });

  test('Tables load after login', async ({ page }) => {
    await page.goto(API_URL);

    // Login first
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin123!');
    await page.click('#btn-login');

    // Wait for tables to load
    await page.waitForTimeout(3000);

    // Check tables grid has content
    const tablesGrid = page.locator('#tables-grid');
    await expect(tablesGrid).toBeVisible();

    const content = await tablesGrid.innerHTML();
    expect(content.length).toBeGreaterThan(50);
    expect(content).not.toContain('Error');
  });

  test('Logout works and returns to login', async ({ page }) => {
    await page.goto(API_URL);

    // Login first
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin123!');
    await page.click('#btn-login');
    await page.waitForSelector('#dashboard-screen.active', { timeout: 10000 });

    // Click logout
    await page.click('.user-menu-btn');
    await page.waitForTimeout(1500);

    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();

    // Should be back at login
    await expect(page.locator('#login-screen.active')).toBeVisible();
    await expect(page.locator('#dashboard-screen')).not.toBeVisible();
  });

  test('Navigation tabs work', async ({ page }) => {
    await page.goto(API_URL);

    // Login
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'Admin123!');
    await page.click('#btn-login');
    await page.waitForSelector('#dashboard-screen.active', { timeout: 10000 });

    // Find and click first tab
    const tabs = page.locator('.nav-item');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);

    await tabs.first().click();
    await page.waitForTimeout(500);

    // Tab should be active
    await expect(tabs.first()).toHaveClass(/active/);
  });
});
