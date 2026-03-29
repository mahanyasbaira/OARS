import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { confirmUploadSchema } from '@/schemas/upload'
import { createUpload } from '@/server/db/sources'
import { getProjectById } from '@/server/db/projects'
import { getUserIdByClerkId } from '@/server/db/users'
import { runExtractionPipeline } from '@/workers/extract-text'
import { runMultimodalPipeline } from '@/workers/extract-multimodal'

const TEXT_MIME_TYPES   = ['application/pdf', 'text/plain', 'text/markdown']
const AUDIO_MIME_TYPES  = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
const VIDEO_MIME_TYPES  = ['video/mp4', 'video/webm', 'video/quicktime']
const IMAGE_MIME_TYPES  = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = await getUserIdByClerkId(clerkId)
  if (!userId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body: unknown = await request.json()
  const parsed = confirmUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { projectId, sourceId, r2Key, originalFilename, mimeType, fileSize } = parsed.data

  // Verify project ownership
  const project = await getProjectById(projectId, userId)
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const upload = await createUpload(sourceId, r2Key, originalFilename, mimeType, fileSize)

  // Auto-trigger the appropriate extraction pipeline
  if (TEXT_MIME_TYPES.includes(mimeType)) {
    runExtractionPipeline(sourceId, projectId, r2Key, mimeType).catch((err) => {
      console.error('[confirm] Text extraction failed:', err)
    })
  } else if (
    AUDIO_MIME_TYPES.includes(mimeType) ||
    VIDEO_MIME_TYPES.includes(mimeType) ||
    IMAGE_MIME_TYPES.includes(mimeType)
  ) {
    runMultimodalPipeline(sourceId, projectId, r2Key, mimeType).catch((err) => {
      console.error('[confirm] Multimodal extraction failed:', err)
    })
  }

  return NextResponse.json({ uploadId: upload.id }, { status: 201 })
}
