import { Resend } from 'resend'

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Sends an email notification when all sources in a project are ready.
 * Silently skips if RESEND_API_KEY is not configured.
 */
export async function sendExtractionCompleteEmail(
  to: string,
  projectName: string,
  projectId: string
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/projects/${projectId}`

  await resend.emails.send({
    from:    'OARS <notifications@oars.app>',
    to,
    subject: `Your project "${projectName}" is ready`,
    html: `
      <p>All sources in your project <strong>${projectName}</strong> have been processed.</p>
      <p>
        <a href="${url}/timeline">View Timeline</a> ·
        <a href="${url}/report">Generate Report</a>
      </p>
      <p style="color:#888;font-size:12px;">OARS — Omnimodal Autonomous Research System</p>
    `,
  }).catch((err) => {
    console.error('[email] Failed to send extraction complete email:', err)
  })
}

/**
 * Sends an email notification when a report has been generated.
 * Silently skips if RESEND_API_KEY is not configured.
 */
export async function sendReportReadyEmail(
  to: string,
  projectName: string,
  projectId: string
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/projects/${projectId}/report`

  await resend.emails.send({
    from:    'OARS <notifications@oars.app>',
    to,
    subject: `Report ready for "${projectName}"`,
    html: `
      <p>Your research report for <strong>${projectName}</strong> is ready.</p>
      <p><a href="${url}">View Report</a></p>
      <p style="color:#888;font-size:12px;">OARS — Omnimodal Autonomous Research System</p>
    `,
  }).catch((err) => {
    console.error('[email] Failed to send report ready email:', err)
  })
}
