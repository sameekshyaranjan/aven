import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { ValidationError } from '../../errors/app-error';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const bucket = env.S3_BUCKET_NAME;
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

export async function ensureDocumentBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404)
      throw error;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [env.CORS_ORIGIN],
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 300,
          },
        ],
      },
    }),
  );
}

export function uploadUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'application/pdf' }),
    { expiresIn: 300 },
  );
}

export function downloadUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 });
}

export async function saveValidatedObject(key: string, bytes: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'application/pdf' }),
  );
}

export async function deleteTemporaryObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function readUploadedObject(
  key: string,
): Promise<{ bytes: Buffer; mediaType: string }> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (!head.ContentLength || head.ContentLength > MAX_DOCUMENT_BYTES)
    throw new ValidationError('The uploaded file size is not allowed.');
  if (head.ContentType !== 'application/pdf')
    throw new ValidationError('Only PDF documents are supported.');

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new ValidationError('The uploaded file is empty.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > MAX_DOCUMENT_BYTES) throw new ValidationError('The uploaded file is too large.');
    chunks.push(Buffer.from(chunk));
  }
  if (size !== head.ContentLength)
    throw new ValidationError('The uploaded file changed during validation.');
  return { bytes: Buffer.concat(chunks), mediaType: head.ContentType };
}
