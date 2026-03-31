import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('renders OARS heading and CTA links', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toContainText('OARS')
    await expect(page.getByRole('link', { name: 'Get started' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })

  test('"Get started" links to /sign-up', async ({ page }) => {
    await page.goto('/')
    const href = await page.getByRole('link', { name: 'Get started' }).getAttribute('href')
    expect(href).toBe('/sign-up')
  })

  test('"Sign in" links to /sign-in', async ({ page }) => {
    await page.goto('/')
    const href = await page.getByRole('link', { name: 'Sign in' }).getAttribute('href')
    expect(href).toBe('/sign-in')
  })
})
