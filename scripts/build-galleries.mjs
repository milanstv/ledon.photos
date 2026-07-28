import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const projectRoot = process.cwd();

const configPath = path.join(
  projectRoot,
  "data",
  "galleries.config.json",
);

const outputPath = path.join(
  projectRoot,
  "data",
  "galleries.ts",
);

const supportedExtensions = new Set([
  ".jpg",
  ".jpeg",
]);

const requiredEnvironmentVariables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ORIGINALS_BUCKET",
  "R2_THUMBS_BUCKET",
  "R2_PUBLIC_URL",
];

for (const variableName of requiredEnvironmentVariables) {
  if (!process.env[variableName]) {
    throw new Error(
      `Chýba premenná ${variableName} v súbore .env.local.`,
    );
  }
}

const r2PublicUrl =
  process.env.R2_PUBLIC_URL.replace(/\/+$/, "");

const r2Client = new S3Client({
  region: "auto",
  endpoint:
    `https://${process.env.R2_ACCOUNT_ID}` +
    ".r2.cloudflarestorage.com",
  credentials: {
    accessKeyId:
      process.env.R2_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.R2_SECRET_ACCESS_KEY,
  },
});

function getCustomerNumber(filename) {
  const nameWithoutExtension =
    path.parse(filename).name;

  const match =
    nameWithoutExtension.match(/-(\d+)$/);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]);
}

function sortPhotos(
  firstFilename,
  secondFilename,
) {
  const firstNumber =
    getCustomerNumber(firstFilename);

  const secondNumber =
    getCustomerNumber(secondFilename);

  if (firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return firstFilename.localeCompare(
    secondFilename,
    "sk",
    {
      numeric: true,
    },
  );
}

function createPublicUrl(slug, filename) {
  const encodedSlug =
    encodeURIComponent(slug);

  const encodedFilename =
    encodeURIComponent(filename);

  return (
    `${r2PublicUrl}/` +
    `${encodedSlug}/${encodedFilename}`
  );
}

async function directoryExists(directoryPath) {
  try {
    const statistics =
      await fs.stat(directoryPath);

    return statistics.isDirectory();
  } catch {
    return false;
  }
}

async function createThumbnail(
  originalPath,
  thumbnailPath,
) {
  let shouldCreateThumbnail = true;

  try {
    const [
      originalStatistics,
      thumbnailStatistics,
    ] = await Promise.all([
      fs.stat(originalPath),
      fs.stat(thumbnailPath),
    ]);

    shouldCreateThumbnail =
      originalStatistics.mtimeMs >
      thumbnailStatistics.mtimeMs;
  } catch {
    shouldCreateThumbnail = true;
  }

  if (!shouldCreateThumbnail) {
    return false;
  }

  await sharp(originalPath)
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 82,
      mozjpeg: true,
    })
    .toFile(thumbnailPath);

  return true;
}

async function removeOldLocalThumbnails(
  thumbnailDirectory,
  originalFilenames,
) {
  const thumbnailExists =
    await directoryExists(thumbnailDirectory);

  if (!thumbnailExists) {
    return;
  }

  const thumbnailFiles =
    await fs.readdir(thumbnailDirectory);

  const originalFilenameSet =
    new Set(originalFilenames);

  for (const thumbnailFilename of thumbnailFiles) {
    const extension = path
      .extname(thumbnailFilename)
      .toLowerCase();

    if (!supportedExtensions.has(extension)) {
      continue;
    }

    if (
      originalFilenameSet.has(
        thumbnailFilename,
      )
    ) {
      continue;
    }

    await fs.unlink(
      path.join(
        thumbnailDirectory,
        thumbnailFilename,
      ),
    );

    console.log(
      `Odstránený starý lokálny náhľad: ` +
      thumbnailFilename,
    );
  }
}

async function remoteObjectIsCurrent({
  bucket,
  key,
  localStatistics,
}) {
  try {
    const response = await r2Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const remoteSize =
      Number(response.Metadata?.localsize);

    const remoteModifiedTime =
      Number(response.Metadata?.localmtime);

    return (
      remoteSize === localStatistics.size &&
      remoteModifiedTime ===
        Math.round(localStatistics.mtimeMs)
    );
  } catch (error) {
    const statusCode =
      error?.$metadata?.httpStatusCode;

    if (
      statusCode === 404 ||
      error?.name === "NotFound" ||
      error?.name === "NoSuchKey"
    ) {
      return false;
    }

    throw error;
  }
}

async function uploadFile({
  bucket,
  key,
  localPath,
  label,
}) {
  const localStatistics =
    await fs.stat(localPath);

  const isCurrent =
    await remoteObjectIsCurrent({
      bucket,
      key,
      localStatistics,
    });

  if (isCurrent) {
    console.log(`Preskočené: ${label}`);

    return false;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(localPath),
      ContentLength: localStatistics.size,
      ContentType: "image/jpeg",
      CacheControl:
        "public, max-age=31536000, immutable",
      Metadata: {
        localsize:
          String(localStatistics.size),
        localmtime:
          String(
            Math.round(
              localStatistics.mtimeMs,
            ),
          ),
      },
    }),
  );

  console.log(`Nahrané: ${label}`);

  return true;
}

async function buildGallery(galleryConfig) {
  const originalDirectory = path.join(
    projectRoot,
    "storage",
    "galleries",
    galleryConfig.slug,
    "originals",
  );

  const thumbnailDirectory = path.join(
    projectRoot,
    "public",
    "galleries",
    galleryConfig.slug,
    "thumbs",
  );

  const originalDirectoryExists =
    await directoryExists(originalDirectory);

  if (!originalDirectoryExists) {
    throw new Error(
      `Chýba priečinok: ${originalDirectory}`,
    );
  }

  await fs.mkdir(thumbnailDirectory, {
    recursive: true,
  });

  const directoryItems =
    await fs.readdir(originalDirectory, {
      withFileTypes: true,
    });

  const originalFilenames = directoryItems
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .filter((filename) =>
      supportedExtensions.has(
        path.extname(filename).toLowerCase(),
      ),
    )
    .sort(sortPhotos);

  await removeOldLocalThumbnails(
    thumbnailDirectory,
    originalFilenames,
  );

  const photos = [];

  console.log("");
  console.log(
    `Galéria: ${galleryConfig.title}`,
  );

  for (const filename of originalFilenames) {
    const originalPath = path.join(
      originalDirectory,
      filename,
    );

    const thumbnailPath = path.join(
      thumbnailDirectory,
      filename,
    );

    const thumbnailCreated =
      await createThumbnail(
        originalPath,
        thumbnailPath,
      );

    if (thumbnailCreated) {
      console.log(
        `Vytvorený náhľad: ${filename}`,
      );
    }

    const objectKey =
      `${galleryConfig.slug}/${filename}`;

    await uploadFile({
      bucket:
        process.env.R2_ORIGINALS_BUCKET,
      key: objectKey,
      localPath: originalPath,
      label:
        `originál/${galleryConfig.slug}/` +
        filename,
    });

    await uploadFile({
      bucket:
        process.env.R2_THUMBS_BUCKET,
      key: objectKey,
      localPath: thumbnailPath,
      label:
        `náhľad/${galleryConfig.slug}/` +
        filename,
    });

    const filenameWithoutExtension =
      path.parse(filename).name;

    const customerNumber =
      getCustomerNumber(filename);

    photos.push({
      id: filenameWithoutExtension,
      customerNumber:
        customerNumber ===
        Number.MAX_SAFE_INTEGER
          ? null
          : customerNumber,
      filename,
      src: createPublicUrl(
        galleryConfig.slug,
        filename,
      ),
      alt:
        customerNumber ===
        Number.MAX_SAFE_INTEGER
          ? (
              `${galleryConfig.title} – ` +
              filenameWithoutExtension
            )
          : (
              `${galleryConfig.title} – ` +
              `fotografia č. ${customerNumber}`
            ),
    });
  }

  console.log(
    `${galleryConfig.title}: ` +
    `${photos.length} fotografií`,
  );

  return {
    slug: galleryConfig.slug,
    title: galleryConfig.title,
    date: galleryConfig.date,
    price: galleryConfig.price,
    photos,
  };
}

async function main() {
  const configurationText =
    await fs.readFile(
      configPath,
      "utf8",
    );

  const galleryConfigurations =
    JSON.parse(configurationText);

  if (
    !Array.isArray(
      galleryConfigurations,
    )
  ) {
    throw new Error(
      "galleries.config.json musí " +
      "obsahovať pole galérií.",
    );
  }

  const galleries = [];

  for (
    const galleryConfig
    of galleryConfigurations
  ) {
    if (
      !galleryConfig.slug ||
      !galleryConfig.title ||
      !galleryConfig.date ||
      typeof galleryConfig.price !==
        "number"
    ) {
      throw new Error(
        "Každá galéria musí mať " +
        "slug, title, date a price.",
      );
    }

    galleries.push(
      await buildGallery(galleryConfig),
    );
  }

  galleries.sort((first, second) =>
    second.slug.localeCompare(
      first.slug,
      "sk",
      {
        numeric: true,
      },
    ),
  );

  const generatedFile = `export type GalleryPhoto = {
  id: string;
  customerNumber: number | null;
  filename: string;
  src: string;
  alt: string;
};

export type Gallery = {
  slug: string;
  title: string;
  date: string;
  price: number;
  photos: GalleryPhoto[];
};

/*
 * Tento súbor je generovaný automaticky.
 * Neupravuj ho ručne.
 * Spusti: npm run gallery
 */
export const galleries: Gallery[] = ${JSON.stringify(
    galleries,
    null,
    2,
  )};

export function getGallery(slug: string) {
  return galleries.find(
    (gallery) => gallery.slug === slug,
  );
}

export function getPhoto(
  slug: string,
  photoId: string,
) {
  const gallery = getGallery(slug);

  if (!gallery) {
    return null;
  }

  const photoIndex = gallery.photos.findIndex(
    (photo) => photo.id === photoId,
  );

  if (photoIndex === -1) {
    return null;
  }

  return {
    gallery,
    photo: gallery.photos[photoIndex],
    previousPhoto:
      photoIndex > 0
        ? gallery.photos[photoIndex - 1]
        : null,
    nextPhoto:
      photoIndex <
      gallery.photos.length - 1
        ? gallery.photos[photoIndex + 1]
        : null,
  };
}
`;

  await fs.writeFile(
    outputPath,
    generatedFile,
    "utf8",
  );

  console.log("");
  console.log(
    "Galérie boli úspešne vytvorené.",
  );

  console.log(
    `Výstup: ${outputPath}`,
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "Chyba pri vytváraní galérií:",
  );

  console.error(
    error?.message ?? error,
  );

  process.exit(1);
});