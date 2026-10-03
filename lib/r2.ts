import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

export function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Chýbajú prihlasovacie údaje Cloudflare R2.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return client;
}

export function getOriginalsBucket(): string {
  const bucket = process.env.R2_ORIGINALS_BUCKET;
  if (!bucket) throw new Error("Chýba R2_ORIGINALS_BUCKET.");
  return bucket;
}

export function getThumbsBucket(): string {
  const bucket = process.env.R2_THUMBS_BUCKET;
  if (!bucket) throw new Error("Chýba R2_THUMBS_BUCKET.");
  return bucket;
}
