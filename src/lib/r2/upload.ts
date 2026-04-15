import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 is S3-compatible — uses the AWS SDK pointed at Cloudflare's endpoint
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

/**
 * Generates a presigned URL that the client can use to upload directly to R2.
 * Expires in 5 minutes.
 */
export async function getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  })
  return getSignedUrl(r2Client, command, { expiresIn: 300 })
}

/**
 * Generates a presigned URL that allows downloading an object from R2.
 * Expires in 1 hour.
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(r2Client, command, { expiresIn: 3600 })
}

/**
 * Deletes an object from R2 by key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  )
}

/**
 * Returns the public URL for a stored object.
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`
}

/**
 * Generates a stable R2 key for a user upload.
 * Pattern: uploads/{userId}/{projectId}/{timestamp}-{sanitizedFilename}
 */
export function buildR2Key(userId: string, projectId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `uploads/${userId}/${projectId}/${timestamp}-${sanitized}`
}

/**
 * Infers modality from mime type.
 */
export function inferModality(mimeType: string): 'text' | 'audio' | 'vision' {
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'vision'
  return 'text'
}

export const ACCEPTED_MIME_TYPES = [
  // Text
  'application/pdf',
  'text/plain',
  'text/markdown',
  // Audio
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
