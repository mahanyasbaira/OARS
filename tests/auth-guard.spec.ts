import { test, expect } from '@playwright/test'

/**
 * Verifies that all protected routes reject unauthenticated access.
 * Clerk middleware redirects browser requests to /sign-in and returns
 * 401 for API requests when no valid session is present.
 */
test.describe('Auth guard — unauthenticated access', () => {
  test('/dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('/dashboard/projects/[id] redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard/projects/non-existent-id')
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('/dashboard/projects/[id]/timeline redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard/projects/non-existent-id/timeline')
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('/dashboard/projects/[id]/report redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard/projects/non-existent-id/report')
    await expect(page).toHaveURL(/\/sign-in/)
  })
})
