import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const projectRoot = process.cwd();

const galleriesRoot = path.join(
  projectRoot,
  "storage",
  "galleries",
);

const thumbnailsRoot = path.join(
  projectRoot,
  "storage",
  "thumbs",
);

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

const DEFAULT_PRICE = 5;

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

const originalsBucket =
  process.env.R2_ORIGINALS_BUCKET;

const thumbsBucket =
  process.env.R2_THUMBS_BUCKET;

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

function isSupportedImage(filename) {
  return supportedExtensions.has(
    path.extname(filename).toLowerCase(),
  );
}

function createPublicUrl(slug, filename) {
  return (
    `${r2PublicUrl}/` +
    `${encodeURIComponent(slug)}/` +
    `${encodeURIComponent(filename)}`
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

async function fileExists(filePath) {
  try {
    const statistics =
      await fs.stat(filePath);

    return statistics.isFile();
  } catch {
    return false;
  }
}

async function readLocalImageFilenames(
  directoryPath,
) {
  if (!(await directoryExists(directoryPath))) {
    return [];
  }

  const directoryItems =
    await fs.readdir(directoryPath, {
      withFileTypes: true,
    });

  return directoryItems
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .filter(isSupportedImage)
    .sort(sortPhotos);
}

async function listR2ImageFilenames({
  bucket,
  slug,
}) {
  const prefix = `${slug}/`;
  const filenames = [];

  let continuationToken;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken:
          continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key) {
        continue;
      }

      const filename =
        object.Key.slice(prefix.length);

      if (
        !filename ||
        filename.includes("/") ||
        !isSupportedImage(filename)
      ) {
        continue;
      }

      filenames.push(filename);
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (continuationToken);

  return [...new Set(filenames)].sort(
    sortPhotos,
  );
}

function parseSlug(slug) {
  const match = slug.match(
    /^(\d{4})-(\d{2})-(\d{2})-(.+)$/,
  );

  if (!match) {
    throw new Error(
      `Nesprávny názov galérie: ${slug}. ` +
      "Použi napríklad 2026-07-02-slovakia-ring.",
    );
  }

  const [
    ,
    year,
    month,
    day,
    namePart,
  ] = match;

  const names = {
    "slovakia-ring": "Slovakia Ring",
    "baba-gp": "Baba GP",
    "pezinska-baba": "Pezinská Baba",
  };

  const automaticName =
    names[namePart] ??
    namePart
      .split("-")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1),
      )
      .join(" ");

  return {
    title: automaticName,
    date:
      `${Number(day)}. ` +
      `${Number(month)}. ${year}`,
  };
}

async function loadConfiguration() {
  if (!(await fileExists(configPath))) {
    return [];
  }

  const configurationText =
    await fs.readFile(
      configPath,
      "utf8",
    );

  const configuration =
    JSON.parse(configurationText);

  if (!Array.isArray(configuration)) {
    throw new Error(
      "galleries.config.json musí obsahovať pole.",
    );
  }

  return configuration;
}

async function discoverLocalGallerySlugs() {
  if (!(await directoryExists(galleriesRoot))) {
    return [];
  }

  const directoryItems =
    await fs.readdir(galleriesRoot, {
      withFileTypes: true,
    });

  return directoryItems
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

async function discoverGallerySlugs(
  manualConfigurations,
) {
  const localSlugs =
    await discoverLocalGallerySlugs();

  const configuredSlugs =
    manualConfigurations
      .map((gallery) => gallery.slug)
      .filter(
        (slug) =>
          typeof slug === "string" &&
          slug.trim(),
      );

  return [
    ...new Set([
      ...configuredSlugs,
      ...localSlugs,
    ]),
  ].sort((first, second) =>
    second.localeCompare(
      first,
      "sk",
      {
        numeric: true,
      },
    ),
  );
}

function createGalleryConfiguration(
  slug,
  manualConfigurations,
) {
  const manualConfiguration =
    manualConfigurations.find(
      (gallery) =>
        gallery.slug === slug,
    );

  const automatic =
    parseSlug(slug);

  return {
    slug,
    title:
      manualConfiguration?.title ??
      automatic.title,
    date:
      manualConfiguration?.date ??
      automatic.date,
    price:
      typeof manualConfiguration?.price ===
      "number"
        ? manualConfiguration.price
        : DEFAULT_PRICE,
  };
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
      Number(
        response.Metadata?.localsize,
      );

    const remoteModifiedTime =
      Number(
        response.Metadata?.localmtime,
      );

    return (
      remoteSize ===
        localStatistics.size &&
      remoteModifiedTime ===
        Math.round(
          localStatistics.mtimeMs,
        )
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
    return false;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body:
        createReadStream(localPath),
      ContentLength:
        localStatistics.size,
      ContentType: "image/jpeg",
      CacheControl:
        "public, max-age=31536000, immutable",
      Metadata: {
        localsize:
          String(
            localStatistics.size,
          ),
        localmtime:
          String(
            Math.round(
              localStatistics.mtimeMs,
            ),
          ),
      },
    }),
  );

  return true;
}

async function uploadLocalGallery({
  galleryConfig,
  originalDirectory,
  thumbnailDirectory,
  originalFilenames,
}) {
  if (
    !(await directoryExists(
      thumbnailDirectory,
    ))
  ) {
    throw new Error(
      `Chýbajú náhľady s vodoznakom: ${thumbnailDirectory}\n` +
      "Najskôr spusti npm run watermark.",
    );
  }

  let uploadedOriginals = 0;
  let uploadedThumbnails = 0;

  for (
    const filename
    of originalFilenames
  ) {
    const originalPath =
      path.join(
        originalDirectory,
        filename,
      );

    const thumbnailPath =
      path.join(
        thumbnailDirectory,
        filename,
      );

    if (
      !(await fileExists(
        thumbnailPath,
      ))
    ) {
      throw new Error(
        `Chýba náhľad s vodoznakom: ${thumbnailPath}`,
      );
    }

    const objectKey =
      `${galleryConfig.slug}/${filename}`;

    const originalUploaded =
      await uploadFile({
        bucket: originalsBucket,
        key: objectKey,
        localPath: originalPath,
      });

    const thumbnailUploaded =
      await uploadFile({
        bucket: thumbsBucket,
        key: objectKey,
        localPath: thumbnailPath,
      });

    if (originalUploaded) {
      uploadedOriginals += 1;
    }

    if (thumbnailUploaded) {
      uploadedThumbnails += 1;
    }
  }

  return {
    uploadedOriginals,
    uploadedThumbnails,
  };
}

async function verifyRemoteGallery({
  galleryConfig,
  localFilenames,
}) {
  const [
    remoteOriginalFilenames,
    remoteThumbnailFilenames,
  ] = await Promise.all([
    listR2ImageFilenames({
      bucket: originalsBucket,
      slug: galleryConfig.slug,
    }),
    listR2ImageFilenames({
      bucket: thumbsBucket,
      slug: galleryConfig.slug,
    }),
  ]);

  const localSet =
    new Set(localFilenames);

  const remoteOriginalSet =
    new Set(
      remoteOriginalFilenames,
    );

  const remoteThumbnailSet =
    new Set(
      remoteThumbnailFilenames,
    );

  const missingOriginals =
    localFilenames.filter(
      (filename) =>
        !remoteOriginalSet.has(
          filename,
        ),
    );

  const missingThumbnails =
    localFilenames.filter(
      (filename) =>
        !remoteThumbnailSet.has(
          filename,
        ),
    );

  const extraOriginals =
    remoteOriginalFilenames.filter(
      (filename) =>
        !localSet.has(filename),
    );

  const extraThumbnails =
    remoteThumbnailFilenames.filter(
      (filename) =>
        !localSet.has(filename),
    );

  if (
    missingOriginals.length > 0 ||
    missingThumbnails.length > 0 ||
    extraOriginals.length > 0 ||
    extraThumbnails.length > 0
  ) {
    throw new Error(
      [
        `R2 kontrola zlyhala: ${galleryConfig.slug}`,
        `Lokálne fotografie: ${localFilenames.length}`,
        `Originály v R2: ${remoteOriginalFilenames.length}`,
        `Náhľady v R2: ${remoteThumbnailFilenames.length}`,
        "",
        "Lokálne fotografie neboli vymazané.",
      ].join("\n"),
    );
  }

  return {
    remoteOriginalCount:
      remoteOriginalFilenames.length,
    remoteThumbnailCount:
      remoteThumbnailFilenames.length,
  };
}

function createPhoto(
  galleryConfig,
  filename,
) {
  const filenameWithoutExtension =
    path.parse(filename).name;

  const customerNumber =
    getCustomerNumber(filename);

  return {
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
        ? `${galleryConfig.title} – ${filenameWithoutExtension}`
        : `${galleryConfig.title} – fotografia č. ${customerNumber}`,
  };
}

async function buildGallery(
  galleryConfig,
) {
  const originalDirectory =
    path.join(
      galleriesRoot,
      galleryConfig.slug,
      "originals",
    );

  const thumbnailDirectory =
    path.join(
      thumbnailsRoot,
      galleryConfig.slug,
    );

  const localOriginalFilenames =
    await readLocalImageFilenames(
      originalDirectory,
    );

  let finalFilenames;
  let source;
  let cleanup = null;
  let uploadedOriginals = 0;
  let uploadedThumbnails = 0;

  if (
    localOriginalFilenames.length > 0
  ) {
    const uploadResult =
      await uploadLocalGallery({
        galleryConfig,
        originalDirectory,
        thumbnailDirectory,
        originalFilenames:
          localOriginalFilenames,
      });

    uploadedOriginals =
      uploadResult.uploadedOriginals;

    uploadedThumbnails =
      uploadResult.uploadedThumbnails;

    await verifyRemoteGallery({
      galleryConfig,
      localFilenames:
        localOriginalFilenames,
    });

    finalFilenames =
      localOriginalFilenames;

    source = "UPLOAD + R2";

    cleanup = {
      slug: galleryConfig.slug,
      originalDirectory,
      thumbnailDirectory,
    };
  } else {
    const remoteOriginalFilenames =
      await listR2ImageFilenames({
        bucket: originalsBucket,
        slug: galleryConfig.slug,
      });

    if (
      remoteOriginalFilenames.length ===
      0
    ) {
      throw new Error(
        `Galéria ${galleryConfig.slug} nemá lokálne originály ani originály v R2.`,
      );
    }

    const remoteThumbnailFilenames =
      await listR2ImageFilenames({
        bucket: thumbsBucket,
        slug: galleryConfig.slug,
      });

    const remoteThumbnailSet =
      new Set(
        remoteThumbnailFilenames,
      );

    const missingThumbnails =
      remoteOriginalFilenames.filter(
        (filename) =>
          !remoteThumbnailSet.has(
            filename,
          ),
      );

    if (
      missingThumbnails.length > 0
    ) {
      throw new Error(
        `V R2 chýbajú náhľady pre galériu ${galleryConfig.slug}:\n` +
        missingThumbnails
          .slice(0, 20)
          .join("\n"),
      );
    }

    finalFilenames =
      remoteOriginalFilenames;

    source = "R2";
  }

  const photos =
    finalFilenames.map(
      (filename) =>
        createPhoto(
          galleryConfig,
          filename,
        ),
    );

  return {
    gallery: {
      slug: galleryConfig.slug,
      title: galleryConfig.title,
      date: galleryConfig.date,
      price: galleryConfig.price,
      photos,
    },
    summary: {
      slug: galleryConfig.slug,
      count: photos.length,
      source,
      uploadedOriginals,
      uploadedThumbnails,
    },
    cleanup,
  };
}

async function removeLocalGalleryFiles(
  cleanup,
) {
  await fs.rm(
    cleanup.originalDirectory,
    {
      recursive: true,
      force: true,
    },
  );

  await fs.rm(
    cleanup.thumbnailDirectory,
    {
      recursive: true,
      force: true,
    },
  );
}

function printSummary(
  summaries,
  cleanupCount,
) {
  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "LEDON. GALÉRIE",
  );
  console.log(
    "==============================================",
  );
  console.log("");

  for (const summary of summaries) {
    const slugColumn =
      summary.slug.padEnd(31, ".");

    const countColumn =
      String(summary.count).padStart(4, " ");

    console.log(
      `✓ ${slugColumn} ${countColumn} fotiek (${summary.source})`,
    );

    if (
      summary.uploadedOriginals > 0 ||
      summary.uploadedThumbnails > 0
    ) {
      console.log(
        `  Nahrané: ${summary.uploadedOriginals} originálov, ` +
        `${summary.uploadedThumbnails} náhľadov`,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    "✓ Originály overené v R2",
  );
  console.log(
    "✓ Náhľady overené v R2",
  );

  if (cleanupCount > 0) {
    console.log(
      `✓ Lokálne súbory odstránené: ${cleanupCount} galérií`,
    );
  } else {
    console.log(
      "✓ Neboli nájdené lokálne fotografie na odstránenie",
    );
  }

  console.log(
    "✓ data/galleries.ts vytvorený",
  );
  console.log(
    "==============================================",
  );
}

async function main() {
  const manualConfigurations =
    await loadConfiguration();

  const discoveredSlugs =
    await discoverGallerySlugs(
      manualConfigurations,
    );

  if (
    discoveredSlugs.length === 0
  ) {
    throw new Error(
      "Nenašla sa žiadna galéria.",
    );
  }

  const galleries = [];
  const summaries = [];
  const cleanupQueue = [];

  for (
    const slug of discoveredSlugs
  ) {
    const galleryConfig =
      createGalleryConfiguration(
        slug,
        manualConfigurations,
      );

    const result =
      await buildGallery(
        galleryConfig,
      );

    galleries.push(
      result.gallery,
    );

    summaries.push(
      result.summary,
    );

    if (result.cleanup) {
      cleanupQueue.push(
        result.cleanup,
      );
    }
  }

  galleries.sort(
    (first, second) =>
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

  const photoIndex =
    gallery.photos.findIndex(
      (photo) =>
        photo.id === photoId,
    );

  if (photoIndex === -1) {
    return null;
  }

  return {
    gallery,
    photo:
      gallery.photos[photoIndex],
    previousPhoto:
      photoIndex > 0
        ? gallery.photos[
            photoIndex - 1
          ]
        : null,
    nextPhoto:
      photoIndex <
      gallery.photos.length - 1
        ? gallery.photos[
            photoIndex + 1
          ]
        : null,
  };
}
`;

  await fs.writeFile(
    outputPath,
    generatedFile,
    "utf8",
  );

  for (
    const cleanup of cleanupQueue
  ) {
    await removeLocalGalleryFiles(
      cleanup,
    );
  }

  printSummary(
    summaries,
    cleanupQueue.length,
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "==============================================",
  );
  console.error(
    "CHYBA PRI VYTVÁRANÍ GALÉRIÍ",
  );
  console.error(
    "==============================================",
  );
  console.error(
    error?.message ?? error,
  );

  process.exit(1);
});