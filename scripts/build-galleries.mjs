import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const projectRoot =
  path.resolve(
    currentDirectory,
    "..",
  );

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

for (
  const variableName
  of requiredEnvironmentVariables
) {
  if (!process.env[variableName]) {
    throw new Error(
      `Chýba premenná ${variableName} v súbore .env.local.`,
    );
  }
}

const r2PublicUrl =
  process.env.R2_PUBLIC_URL.replace(
    /\/+$/,
    "",
  );

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

function getCustomerNumber(
  filename,
) {
  const nameWithoutExtension =
    path.parse(filename).name;

  const match =
    nameWithoutExtension.match(
      /-(\d+)$/,
    );

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
    getCustomerNumber(
      firstFilename,
    );

  const secondNumber =
    getCustomerNumber(
      secondFilename,
    );

  if (
    firstNumber !==
    secondNumber
  ) {
    return (
      firstNumber -
      secondNumber
    );
  }

  return firstFilename.localeCompare(
    secondFilename,
    "sk",
    {
      numeric: true,
    },
  );
}

function isSupportedImage(
  filename,
) {
  return supportedExtensions.has(
    path
      .extname(filename)
      .toLowerCase(),
  );
}

function createPublicUrl(
  slug,
  filename,
) {
  return (
    `${r2PublicUrl}/` +
    `${encodeURIComponent(slug)}/` +
    `${encodeURIComponent(filename)}`
  );
}

async function directoryExists(
  directoryPath,
) {
  try {
    const statistics =
      await fs.stat(
        directoryPath,
      );

    return statistics.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(
  filePath,
) {
  try {
    const statistics =
      await fs.stat(
        filePath,
      );

    return statistics.isFile();
  } catch {
    return false;
  }
}

async function readLocalImageFilenames(
  directoryPath,
) {
  if (
    !(await directoryExists(
      directoryPath,
    ))
  ) {
    return [];
  }

  const directoryItems =
    await fs.readdir(
      directoryPath,
      {
        withFileTypes: true,
      },
    );

  return directoryItems
    .filter(
      (item) =>
        item.isFile(),
    )
    .map(
      (item) =>
        item.name,
    )
    .filter(
      isSupportedImage,
    )
    .sort(
      sortPhotos,
    );
}

async function listR2ImageFilenames({
  bucket,
  slug,
}) {
  const prefix =
    `${slug}/`;

  const filenames = [];

  let continuationToken;

  do {
    const response =
      await r2Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
        }),
      );

    for (
      const object
      of response.Contents ?? []
    ) {
      if (!object.Key) {
        continue;
      }

      const filename =
        object.Key.slice(
          prefix.length,
        );

      if (
        !filename ||
        filename.includes("/") ||
        !isSupportedImage(
          filename,
        )
      ) {
        continue;
      }

      filenames.push(
        filename,
      );
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (
    continuationToken
  );

  return [
    ...new Set(
      filenames,
    ),
  ].sort(
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
    "slovakia-ring":
      "Slovakia Ring",
    "baba-gp":
      "Baba GP",
    "pezinska-baba":
      "Pezinská Baba",
  };

  const automaticName =
    names[namePart] ??
    namePart
      .split("-")
      .map(
        (word) =>
          word
            .charAt(0)
            .toUpperCase() +
          word.slice(1),
      )
      .join(" ");

  return {
    title:
      automaticName,

    date:
      `${Number(day)}. ` +
      `${Number(month)}. ${year}`,
  };
}

async function loadConfiguration() {
  if (
    !(await fileExists(
      configPath,
    ))
  ) {
    return [];
  }

  const configurationText =
    await fs.readFile(
      configPath,
      "utf8",
    );

  const configuration =
    JSON.parse(
      configurationText,
    );

  if (
    !Array.isArray(
      configuration,
    )
  ) {
    throw new Error(
      "galleries.config.json musí obsahovať pole.",
    );
  }

  return configuration;
}

async function discoverLocalGallerySlugs() {
  if (
    !(await directoryExists(
      galleriesRoot,
    ))
  ) {
    return [];
  }

  const directoryItems =
    await fs.readdir(
      galleriesRoot,
      {
        withFileTypes: true,
      },
    );

  return directoryItems
    .filter(
      (item) =>
        item.isDirectory(),
    )
    .map(
      (item) =>
        item.name,
    );
}

async function discoverGallerySlugs(
  manualConfigurations,
) {
  const localSlugs =
    await discoverLocalGallerySlugs();

  const configuredSlugs =
    manualConfigurations
      .map(
        (gallery) =>
          gallery.slug,
      )
      .filter(
        (slug) =>
          typeof slug ===
            "string" &&
          slug.trim(),
      );

  return [
    ...new Set([
      ...configuredSlugs,
      ...localSlugs,
    ]),
  ].sort(
    (first, second) =>
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
        gallery.slug ===
        slug,
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

async function uploadFile({
  bucket,
  key,
  localPath,
}) {
  const localStatistics =
    await fs.stat(
      localPath,
    );

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,

      Body:
        createReadStream(
          localPath,
        ),

      ContentLength:
        localStatistics.size,

      ContentType:
        "image/jpeg",

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
}

async function uploadMissingFiles({
  galleryConfig,
  originalDirectory,
  thumbnailDirectory,
  localOriginalFilenames,
  remoteOriginalFilenames,
  remoteThumbnailFilenames,
}) {
  const remoteOriginalSet =
    new Set(
      remoteOriginalFilenames,
    );

  const remoteThumbnailSet =
    new Set(
      remoteThumbnailFilenames,
    );

  const newOriginals =
    localOriginalFilenames.filter(
      (filename) =>
        !remoteOriginalSet.has(
          filename,
        ),
    );

  const thumbnailsToUpload =
    localOriginalFilenames.filter(
      (filename) =>
        !remoteThumbnailSet.has(
          filename,
        ),
    );

  for (
    const filename
    of newOriginals
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
        `Chýba náhľad s vodoznakom pre novú fotografiu:\n${thumbnailPath}\n` +
        "Najskôr spusti npm run watermark.",
      );
    }

    await uploadFile({
      bucket:
        originalsBucket,

      key:
        `${galleryConfig.slug}/${filename}`,

      localPath:
        originalPath,
    });
  }

  for (
    const filename
    of thumbnailsToUpload
  ) {
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
        `Chýba náhľad s vodoznakom:\n${thumbnailPath}\n` +
        "Najskôr spusti npm run watermark.",
      );
    }

    await uploadFile({
      bucket:
        thumbsBucket,

      key:
        `${galleryConfig.slug}/${filename}`,

      localPath:
        thumbnailPath,
    });
  }

  return {
    newOriginals,
    thumbnailsToUpload,
  };
}

async function verifyFinalGallery({
  galleryConfig,
  expectedFilenames,
}) {
  const [
    remoteOriginalFilenames,
    remoteThumbnailFilenames,
  ] = await Promise.all([
    listR2ImageFilenames({
      bucket:
        originalsBucket,

      slug:
        galleryConfig.slug,
    }),

    listR2ImageFilenames({
      bucket:
        thumbsBucket,

      slug:
        galleryConfig.slug,
    }),
  ]);

  const originalSet =
    new Set(
      remoteOriginalFilenames,
    );

  const thumbnailSet =
    new Set(
      remoteThumbnailFilenames,
    );

  const missingOriginals =
    expectedFilenames.filter(
      (filename) =>
        !originalSet.has(
          filename,
        ),
    );

  const missingThumbnails =
    expectedFilenames.filter(
      (filename) =>
        !thumbnailSet.has(
          filename,
        ),
    );

  if (
    missingOriginals.length > 0 ||
    missingThumbnails.length > 0
  ) {
    throw new Error(
      [
        `R2 kontrola zlyhala: ${galleryConfig.slug}`,

        `Očakávaných fotografií: ${expectedFilenames.length}`,

        `Originály v R2: ${remoteOriginalFilenames.length}`,

        `Náhľady v R2: ${remoteThumbnailFilenames.length}`,

        "",

        missingOriginals.length > 0
          ? `Chýbajúce originály:\n${missingOriginals
              .slice(0, 20)
              .join("\n")}`
          : "",

        missingThumbnails.length > 0
          ? `Chýbajúce náhľady:\n${missingThumbnails
              .slice(0, 20)
              .join("\n")}`
          : "",

        "",

        "Lokálne fotografie neboli vymazané.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    remoteOriginalFilenames,
    remoteThumbnailFilenames,
  };
}

function createPhoto(
  galleryConfig,
  filename,
) {
  const filenameWithoutExtension =
    path.parse(
      filename,
    ).name;

  const customerNumber =
    getCustomerNumber(
      filename,
    );

  return {
    id:
      filenameWithoutExtension,

    customerNumber:
      customerNumber ===
      Number.MAX_SAFE_INTEGER
        ? null
        : customerNumber,

    filename,

    src:
      createPublicUrl(
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

  const [
    localOriginalFilenames,
    remoteOriginalFilenamesBefore,
    remoteThumbnailFilenamesBefore,
  ] = await Promise.all([
    readLocalImageFilenames(
      originalDirectory,
    ),

    listR2ImageFilenames({
      bucket:
        originalsBucket,

      slug:
        galleryConfig.slug,
    }),

    listR2ImageFilenames({
      bucket:
        thumbsBucket,

      slug:
        galleryConfig.slug,
    }),
  ]);

  if (
    localOriginalFilenames.length === 0 &&
    remoteOriginalFilenamesBefore.length === 0
  ) {
    throw new Error(
      `Galéria ${galleryConfig.slug} nemá lokálne originály ani originály v R2.`,
    );
  }

  let uploadedOriginals = 0;
  let uploadedThumbnails = 0;
  let cleanup = null;

  if (
    localOriginalFilenames.length > 0
  ) {
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

    const uploadResult =
      await uploadMissingFiles({
        galleryConfig,

        originalDirectory,

        thumbnailDirectory,

        localOriginalFilenames,

        remoteOriginalFilenames:
          remoteOriginalFilenamesBefore,

        remoteThumbnailFilenames:
          remoteThumbnailFilenamesBefore,
      });

    uploadedOriginals =
      uploadResult
        .newOriginals
        .length;

    uploadedThumbnails =
      uploadResult
        .thumbnailsToUpload
        .length;

    cleanup = {
      slug:
        galleryConfig.slug,

      originalDirectory,

      thumbnailDirectory,
    };
  }

  const expectedFilenames = [
    ...new Set([
      ...remoteOriginalFilenamesBefore,
      ...localOriginalFilenames,
    ]),
  ].sort(
    sortPhotos,
  );

  const verified =
    await verifyFinalGallery({
      galleryConfig,
      expectedFilenames,
    });

  const finalFilenames =
    verified
      .remoteOriginalFilenames
      .sort(
        sortPhotos,
      );

  const photos =
    finalFilenames.map(
      (filename) =>
        createPhoto(
          galleryConfig,
          filename,
        ),
    );

  let source = "R2";

  if (
    uploadedOriginals > 0 ||
    uploadedThumbnails > 0
  ) {
    source =
      "DOPLNENÉ + R2";
  } else if (
    localOriginalFilenames.length > 0
  ) {
    source =
      "BEZ ZMIEN + R2";
  }

  return {
    gallery: {
      slug:
        galleryConfig.slug,

      title:
        galleryConfig.title,

      date:
        galleryConfig.date,

      price:
        galleryConfig.price,

      photos,
    },

    summary: {
      slug:
        galleryConfig.slug,

      count:
        photos.length,

      source,

      uploadedOriginals,

      uploadedThumbnails,

      localCount:
        localOriginalFilenames.length,

      previousRemoteCount:
        remoteOriginalFilenamesBefore.length,
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

  for (
    const summary
    of summaries
  ) {
    const slugColumn =
      summary.slug.padEnd(
        31,
        ".",
      );

    const countColumn =
      String(
        summary.count,
      ).padStart(
        4,
        " ",
      );

    console.log(
      `✓ ${slugColumn} ${countColumn} fotiek (${summary.source})`,
    );

    if (
      summary.uploadedOriginals > 0 ||
      summary.uploadedThumbnails > 0
    ) {
      console.log(
        `  Predtým v R2: ${summary.previousRemoteCount}`,
      );

      console.log(
        `  Lokálne dodané: ${summary.localCount}`,
      );

      console.log(
        `  Nové originály: ${summary.uploadedOriginals}`,
      );

      console.log(
        `  Nové náhľady: ${summary.uploadedThumbnails}`,
      );

      console.log(
        `  Výsledok v galérii: ${summary.count}`,
      );
    }
  }

  console.log("");

  console.log(
    "==============================================",
  );

  console.log(
    "✓ Existujúce fotografie v R2 zostali zachované",
  );

  console.log(
    "✓ Nové originály overené v R2",
  );

  console.log(
    "✓ Nové náhľady overené v R2",
  );

  if (
    cleanupCount > 0
  ) {
    console.log(
      `✓ Lokálne pracovné súbory odstránené: ${cleanupCount} galérií`,
    );
  } else {
    console.log(
      "✓ Neboli nájdené lokálne pracovné fotografie",
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
    const slug
    of discoveredSlugs
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

    if (
      result.cleanup
    ) {
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
  const gallery =
    getGallery(slug);

  if (!gallery) {
    return null;
  }

  const photoIndex =
    gallery.photos.findIndex(
      (photo) =>
        photo.id === photoId,
    );

  if (
    photoIndex === -1
  ) {
    return null;
  }

  return {
    gallery,

    photo:
      gallery.photos[
        photoIndex
      ],

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
    const cleanup
    of cleanupQueue
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

main().catch(
  (error) => {
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
      error?.message ??
      error,
    );

    process.exit(1);
  },
);
