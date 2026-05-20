#!/usr/bin/env tsx
/**
 * Upload tarball to Supabase Storage
 *
 * Uploads the pre-built sandbox tarball to Supabase Storage
 * using TUS resumable upload protocol for large files.
 */

import * as tus from 'tus-js-client'
import * as fs from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const TARBALL_PATH = 'tmp/sandbox-template.tar.gz'
const SUPABASE_URL = 'https://qnkkfqdqjtzllohufcjs.supabase.co'
// Use service role key to bypass RLS policies
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET_NAME = 'Catalyst Studio'
const FILE_PATH = 'sandbox-templates/sandbox-template.tar.gz'

function log(message: string): void {
  console.log(`[upload-tarball] ${message}`)
}

async function main(): Promise<void> {
  log('Starting tarball upload to Supabase Storage via TUS...')

  if (!fs.existsSync(TARBALL_PATH)) {
    throw new Error(`Tarball not found: ${TARBALL_PATH}`)
  }

  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in environment')
  }

  const fileSize = fs.statSync(TARBALL_PATH).size
  log(`Tarball size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)
  log(`Bucket: ${BUCKET_NAME}`)
  log(`Path: ${FILE_PATH}`)

  // Read file as buffer for TUS upload
  log('Reading tarball file...')
  const fileBuffer = fs.readFileSync(TARBALL_PATH)

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let lastPercent = 0

    const upload = new tus.Upload(fileBuffer, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'x-upsert': 'true', // Replace existing file
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET_NAME,
        objectName: FILE_PATH,
        contentType: 'application/gzip',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6 MB chunks
      onError: (error) => {
        log(`Upload error: ${error.message}`)
        reject(error)
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = Math.round((bytesUploaded / bytesTotal) * 100)
        if (percent > lastPercent && percent % 5 === 0) {
          lastPercent = percent
          log(`Progress: ${percent}% (${(bytesUploaded / 1024 / 1024).toFixed(1)} MB / ${(bytesTotal / 1024 / 1024).toFixed(1)} MB)`)
        }
      },
      onSuccess: () => {
        const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1)
        log(`Upload complete in ${uploadTime}s`)
        log(`Public URL: ${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET_NAME)}/${FILE_PATH}`)
        resolve()
      },
    })

    // Check for previous upload attempts
    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        log(`Resuming previous upload...`)
        upload.resumeFromPreviousUpload(previousUploads[0])
      }
      upload.start()
    })
  })
}

main().catch(err => {
  console.error('[upload-tarball] Error:', err.message)
  process.exit(1)
})
