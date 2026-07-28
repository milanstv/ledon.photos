import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const requiredVariables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ORIGINALS_BUCKET",
  "R2_THUMBS_BUCKET",
];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    console.error(
      `Chýba premenná ${variableName} v súbore .env.local`,
    );
    process.exit(1);
  }
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function testBucket(bucketName) {
  const key = "__connection-test.txt";
  const testContent = `LEDON R2 test: ${new Date().toISOString()}`;

  console.log(`Testujem bucket: ${bucketName}`);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: testContent,
      ContentType: "text/plain",
    }),
  );

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  const downloadedContent =
    await response.Body.transformToString();

  if (downloadedContent !== testContent) {
    throw new Error(
      `Obsah testovacieho súboru v buckete ${bucketName} nesúhlasí.`,
    );
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  console.log(`✓ Čítanie a zápis fungujú: ${bucketName}`);
}

try {
  console.log("");

  await testBucket(process.env.R2_ORIGINALS_BUCKET);
  await testBucket(process.env.R2_THUMBS_BUCKET);

  console.log("");
  console.log("Spojenie s Cloudflare R2 funguje.");
} catch (error) {
  console.error("");
  console.error("Test R2 zlyhal.");
  console.error(error);
  process.exit(1);
}