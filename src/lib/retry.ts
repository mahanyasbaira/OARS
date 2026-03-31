/**
 * Retries an async function with exponential backoff.
 * Delays: 2s, 4s, 8s (max 3 attempts by default).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; label?: string } = {}
): Promise<T> {
  const maxAttempts = options.attempts ?? 3
  const label = options.label ?? 'operation'

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt) * 1000
        console.warn(
          `[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs / 1000}s:`,
          err instanceof Error ? err.message : err
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Unknown error'
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${message}`)
}
