import { test, expect } from '@playwright/test'

test.describe('Admin Panel', () => {
  test.beforeAll(async ({ request }) => {
    // Create a test admin user using admin token
    const response = await request.post('/api/users', {
      headers: {
        'x-admin-token': 'admin-secret',
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      }
    })
    expect(response.ok()).toBeTruthy()
  })

  test('admin login and logout', async ({ page }) => {
    await page.goto('/')

    // Open admin modal
    const adminBtn = page.locator('button:has-text("ADMIN")')
    await adminBtn.click()

    // Wait for modal to appear
    const modal = page.locator('div[class*="modal"], div[class*="overlay"]').first()
    await expect(modal).toBeVisible()

    // Enter admin credentials
    await page.fill('input[placeholder="Admin email"]', 'admin@example.com')
    await page.fill('input[placeholder="Password"]', 'admin123')

    // Click login
    await page.click('button:has-text("Login")')

    // Should stay logged in or show success (check for logout button)
    const logoutBtn = page.locator('button:has-text("Logout")')
    await expect(logoutBtn).toBeVisible()

    // Logout
    await logoutBtn.click()
    await expect(logoutBtn).not.toBeVisible()
  })

  test('create and delete user', async ({ page }) => {
    await page.goto('/')

    // Open admin modal
    const adminBtn = page.locator('button:has-text("ADMIN")')
    await adminBtn.click()

    // Login first
    await page.fill('input[placeholder="Admin email"]', 'admin@example.com')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Login")')

    // Create new user
    await page.fill('input[placeholder="Name"]', 'Test User')
    await page.fill('input[placeholder="Email"]', 'test@example.com')
    await page.fill('input[placeholder="Password"]', 'testpass')
    await page.selectOption('select', 'team')

    await page.click('button:has-text("Create user")')

    // Check if user appears in list
    await expect(page.locator('text=Test User (team)')).toBeVisible()

    // Delete the user
    await page.click('button:has-text("Delete")').first()

    // User should be removed
    await expect(page.locator('text=Test User (team)')).not.toBeVisible()
  })

  test('add and delete service', async ({ page }) => {
    await page.goto('/')

    // Open admin modal
    const adminBtn = page.locator('button:has-text("ADMIN")')
    await adminBtn.click()

    // Login
    await page.fill('input[placeholder="Admin email"]', 'admin@example.com')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Login")')

    // Add service
    await page.fill('input[placeholder="Service title"]', 'Test Infrastructure Service')
    await page.fill('textarea[placeholder="Service description"]', 'A test service for infrastructure')
    await page.selectOption('select', 'infrastructure')

    await page.click('button:has-text("Add service")')

    // Check if service appears
    await expect(page.locator('text=Test Infrastructure Service (infrastructure)')).toBeVisible()

    // Delete the service
    await page.click('button:has-text("Delete")').last()

    // Service should be removed
    await expect(page.locator('text=Test Infrastructure Service (infrastructure)')).not.toBeVisible()
  })

  test('view contacts', async ({ page }) => {
    await page.goto('/')

    // Open admin modal
    const adminBtn = page.locator('button:has-text("ADMIN")')
    await adminBtn.click()

    // Login
    await page.fill('input[placeholder="Admin email"]', 'admin@example.com')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Login")')

    // Check contacts section exists
    const contactsHeader = page.locator('h3:has-text("Contacts")')
    await expect(contactsHeader).toBeVisible()

    // Contacts list should be present (may be empty)
    const contactsList = page.locator('ul').last()
    await expect(contactsList).toBeVisible()
  })
})