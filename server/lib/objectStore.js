import fs from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { ensureUploadDir, filePath } from './uploads.js';

let client;

function s3() {
  if (!config.s3Bucket || !config.s3AccessKeyId || !config.s3SecretAccessKey) return null;
  if (!client) {
    client = new S3Client({
      region: config.s3Region || 'auto',
      endpoint: config.s3Endpoint || undefined,
      forcePathStyle: config.s3UrlStyle === 'path',
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
    });
  }
  return client;
}

export function usesObjectStore() {
  return Boolean(s3());
}

export async function saveObject(key, body, contentType) {
  const store = s3();
  if (store) {
    await store.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }));
    return;
  }
  ensureUploadDir();
  fs.writeFileSync(filePath(key), body);
}

export async function readObject(key) {
  const store = s3();
  if (store) {
    const result = await store.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
    return result.Body;
  }
  const full = filePath(key);
  if (!fs.existsSync(full)) return null;
  return fs.createReadStream(full);
}

export async function deleteObject(key) {
  if (!key) return;
  const store = s3();
  if (store) {
    await store.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key })).catch(() => {});
    return;
  }
  try {
    fs.unlinkSync(filePath(key));
  } catch {
    // ignore missing files
  }
}
