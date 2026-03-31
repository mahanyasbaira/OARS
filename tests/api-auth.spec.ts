import { test, expect } from '@playwright/test'

/**
 * Verifies that API endpoints return 401 for unauthenticated requests.
 */
test.describe('API auth guard — unauthenticated requests', () => {
  test('GET /api/projects returns 401', async ({ request }) => {
    const res = await request.get('/api/projects')
    expect(res.status()).toBe(401)
  })

  test('POST /api/projects returns 401', async ({ request }) => {
    const res = await request.post('/api/projects', { data: { name: 'test' } })
    expect(res.status()).toBe(401)
  })

  test('GET /api/projects/[id]/report/export returns 401', async ({ request }) => {
    const res = await request.get('/api/projects/non-existent-id/report/export')
    expect(res.status()).toBe(401)
  })

  test('POST /api/upload/presign returns 401', async ({ request }) => {
    const res = await request.post('/api/upload/presign', {
      data: { filename: 'test.pdf', mimeType: 'application/pdf', size: 1024 },
    })
    expect(res.status()).toBe(401)
  })
})
