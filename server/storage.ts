// Cloudflare R2 storage integration using AWS SDK
// Uses S3-compatible API to upload to R2 bucket

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";

type StorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  publicUrl: string;
};

function getStorageConfig(): StorageConfig {
  const accessKeyId = ENV.R2_ACCESS_KEY_ID;
  const secretAccessKey = ENV.R2_SECRET_ACCESS_KEY;
  const endpoint = ENV.R2_ENDPOINT;
  const bucket = ENV.R2_BUCKET;
  const publicUrl = ENV.R2_PUBLIC_URL;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket || !publicUrl) {
    throw new Error(
      "R2 credentials missing: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, and R2_PUBLIC_URL"
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ""),
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const client = getS3Client(config);
  try {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await client.send(command);
    const publicUrl = `${config.publicUrl}/${key}`;
    return { key, url: publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`R2 upload failed: ${message}`);
  } finally {
    client.destroy();
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);
  const client = getS3Client(config);
  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    await client.send(command);
    const publicUrl = `${config.publicUrl}/${key}`;
    return { key, url: publicUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`R2 object not found: ${message}`);
  } finally {
    client.destroy();
  }
}
