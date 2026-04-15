import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Auth guard — unauthenticated users must be redirected away from /neuro
// ---------------------------------------------------------------------------
test.describe('Neuro tab auth guard', () => {
  test('redirects unauthenticated user away from /neuro', async ({ page }) => {
    // Use a fake project id — we only care about the auth redirect
    await page.goto('/dashboard/projects/00000000-0000-0000-0000-000000000001/neuro', {
      waitUntil: 'networkidle',
    })
    // Clerk redirects to /sign-in (or /) for unauthenticated sessions
    expect(page.url()).not.toContain('/neuro')
  })
})

// ---------------------------------------------------------------------------
// API auth guards — all neuro routes must return 401 without a session
// ---------------------------------------------------------------------------
test.describe('Neuro API — 401 guards', () => {
  const fakeId = '00000000-0000-0000-0000-000000000001'

  test('POST /api/projects/:id/neuro/analyze returns 401 without auth', async ({ request }) => {
    const res = await request.post(`/api/projects/${fakeId}/neuro/analyze`, {
      data: { source_id: fakeId, extraction_id: fakeId },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/projects/:id/neuro/status returns 401 without auth', async ({ request }) => {
    const res = await request.get(`/api/projects/${fakeId}/neuro/status`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/projects/:id/neuro/results returns 401 without auth', async ({ request }) => {
    const res = await request.get(
      `/api/projects/${fakeId}/neuro/results?analysis_id=${fakeId}`
    )
    expect(res.status()).toBe(401)
  })
})
