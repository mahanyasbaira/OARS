import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight mb-3">OARS</h1>
        <p className="text-muted-foreground text-lg mb-2">Omnimodal Autonomous Research System</p>
        <p className="text-muted-foreground text-sm mb-8">
          Upload PDFs, audio, and video. Specialized agents extract structured findings,
          align them on a shared timeline, and generate source-grounded research reports.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
