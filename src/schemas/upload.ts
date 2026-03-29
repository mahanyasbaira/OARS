import { z } from 'zod'
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/r2/upload'

export const requestUploadUrlSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ACCEPTED_MIME_TYPES as unknown as [string, ...string[]]),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
})

export const confirmUploadSchema = z.object({
  projectId: z.string().uuid(),
  sourceId: z.string().uuid(),
  r2Key: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
})

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>
