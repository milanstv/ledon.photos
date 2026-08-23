import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import sharp from "sharp";

// =====================================================
// .ENV.LOCAL
// =====================================================

const projectRoot =
  process.cwd();

const envPath =
  path.join(
    projectRoot,
    ".env.local",
  );

try {
  process.loadEnvFile(
    envPath,
  );
} catch {
  // Ak .env.local nie je,
  // premenné môžu byť nastavené systémovo.
}

// =====================================================
// NASTAVENIA VODOZNAKU
// =====================================================

// Veľké LD uprostred fotografie
const CENTER_OPACITY = 0.30;
const CENTER_SIZE = 0.78;

// Malé logo LEDON. vpravo dole
const CORNER_OPACITY = 1.0;
const CORNER_SIZE = 0.08;
const CORNER_MARGIN = 0.025;

// Výstupné náhľady
const MAX_IMAGE_SIZE = 2000;
const JPEG_QUALITY = 82;

// true = vždy vytvorí lokálny náhľad znova
// false = rešpektuje existujúci lokálny náhľad
const FORCE_REBUILD = false;

// =====================================================
// CESTY
// =====================================================

const currentScriptPath =
  fileURLToPath(
    import.meta.url,
  );

const galleriesDirectory =
  path.join(
    projectRoot,
    "storage",
    "galleries",
  );

const outputRoot =
  path.join(
    projectRoot,
    "storage",
    "thumbs",
  );

const centerLogoPath =
  path.join(
    projectRoot,
    "public",
    "images",
    "LD-center.png",
  );

const cornerLogoPath =
  path.join(
    projectRoot,
    "public",
    "images",
    "LEDON-logo-white-transparent.png",
  );

const supportedExtensions =
  new Set([
    ".jpg",
    ".jpeg",
  ]);

// =====================================================
// R2
// =====================================================

const requiredEnvironmentVariables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_THUMBS_BUCKET",
];

for (
  const variableName
  of requiredEnvironmentVariables
) {
  if (
    !process.env[
      variableName
    ]
  ) {
    throw new Error(
      `Chýba premenná ${variableName} v .env.local.`,
    );
  }
}

const thumbsBucket =
  process.env
    .R2_THUMBS_BUCKET;

const r2Client =
  new S3Client({
    region: "auto",

    endpoint:
      `https://${process.env.R2_ACCOUNT_ID}` +
      ".r2.cloudflarestorage.com",

    credentials: {
      accessKeyId:
        process.env
          .R2_ACCESS_KEY_ID,

      secretAccessKey:
        process.env
          .R2_SECRET_ACCESS_KEY,
    },
  });

// =====================================================
// POMOCNÉ FUNKCIE
// =====================================================

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

function isSupportedImage(
  filename,
) {
  return supportedExtensions.has(
    path
      .extname(filename)
      .toLowerCase(),
  );
}

function validateSettings() {
  const opacitySettings = [
    [
      "CENTER_OPACITY",
      CENTER_OPACITY,
    ],
    [
      "CORNER_OPACITY",
      CORNER_OPACITY,
    ],
  ];

  for (
    const [name, value]
    of opacitySettings
  ) {
    if (
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        `${name} musí byť číslo od 0 do 1.`,
      );
    }
  }

  const sizeSettings = [
    [
      "CENTER_SIZE",
      CENTER_SIZE,
    ],
    [
      "CORNER_SIZE",
      CORNER_SIZE,
    ],
    [
      "CORNER_MARGIN",
      CORNER_MARGIN,
    ],
  ];

  for (
    const [name, value]
    of sizeSettings
  ) {
    if (
      value <= 0 ||
      value > 1
    ) {
      throw new Error(
        `${name} musí byť väčšie ako 0 a maximálne 1.`,
      );
    }
  }

  if (
    MAX_IMAGE_SIZE < 100
  ) {
    throw new Error(
      "MAX_IMAGE_SIZE musí byť minimálne 100.",
    );
  }

  if (
    JPEG_QUALITY < 1 ||
    JPEG_QUALITY > 100
  ) {
    throw new Error(
      "JPEG_QUALITY musí byť od 1 do 100.",
    );
  }
}

// =====================================================
// ZOZNAM NÁHĽADOV NA R2
// =====================================================

async function listR2ThumbnailFilenames(
  slug,
) {
  const prefix =
    `${slug}/`;

  const filenames = [];

  let continuationToken;

  do {
    const response =
      await r2Client.send(
        new ListObjectsV2Command({
          Bucket:
            thumbsBucket,

          Prefix:
            prefix,

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

  return new Set(
    filenames,
  );
}

// =====================================================
// LOGO + OPACITY
// =====================================================

async function createLogoWithOpacity(
  logoPath,
  width,
  opacity,
) {
  const {
    data,
    info,
  } = await sharp(
    logoPath,
  )
    .resize({
      width,
      withoutEnlargement:
        true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject:
        true,
    });

  const pixels =
    Buffer.from(
      data,
    );

  for (
    let alphaIndex = 3;
    alphaIndex <
    pixels.length;
    alphaIndex += 4
  ) {
    pixels[
      alphaIndex
    ] = Math.round(
      pixels[
        alphaIndex
      ] * opacity,
    );
  }

  return sharp(
    pixels,
    {
      raw: {
        width:
          info.width,

        height:
          info.height,

        channels: 4,
      },
    },
  )
    .png()
    .toBuffer();
}

// =====================================================
// KONTROLA LOKÁLNEHO NÁHĽADU
// =====================================================

async function shouldCreatePreview(
  originalPath,
  outputPath,
) {
  if (
    FORCE_REBUILD
  ) {
    return true;
  }

  try {
    const [
      originalStatistics,
      outputStatistics,
      centerLogoStatistics,
      cornerLogoStatistics,
      scriptStatistics,
    ] =
      await Promise.all([
        fs.stat(
          originalPath,
        ),

        fs.stat(
          outputPath,
        ),

        fs.stat(
          centerLogoPath,
        ),

        fs.stat(
          cornerLogoPath,
        ),

        fs.stat(
          currentScriptPath,
        ),
      ]);

    const newestSourceTime =
      Math.max(
        originalStatistics
          .mtimeMs,

        centerLogoStatistics
          .mtimeMs,

        cornerLogoStatistics
          .mtimeMs,

        scriptStatistics
          .mtimeMs,
      );

    return (
      outputStatistics
        .mtimeMs <
      newestSourceTime
    );
  } catch {
    return true;
  }
}

// =====================================================
// VYTVORENIE NÁHĽADU
// =====================================================

async function createPreview(
  originalPath,
  outputPath,
) {
  const mustCreate =
    await shouldCreatePreview(
      originalPath,
      outputPath,
    );

  if (!mustCreate) {
    console.log(
      `Lokálny náhľad už existuje: ${path.basename(originalPath)}`,
    );

    return false;
  }

  const {
    data: previewBuffer,
    info: previewInfo,
  } =
    await sharp(
      originalPath,
    )
      .rotate()
      .resize({
        width:
          MAX_IMAGE_SIZE,

        height:
          MAX_IMAGE_SIZE,

        fit:
          "inside",

        withoutEnlargement:
          true,
      })
      .toBuffer({
        resolveWithObject:
          true,
      });

  const imageWidth =
    previewInfo.width;

  const imageHeight =
    previewInfo.height;

  // Stredové LD
  const centerLogoWidth =
    Math.max(
      1,
      Math.round(
        imageWidth *
        CENTER_SIZE,
      ),
    );

  const centerLogo =
    await createLogoWithOpacity(
      centerLogoPath,
      centerLogoWidth,
      CENTER_OPACITY,
    );

  // Malé LEDON logo
  const cornerLogoWidth =
    Math.max(
      1,
      Math.round(
        imageWidth *
        CORNER_SIZE,
      ),
    );

  const cornerLogo =
    await createLogoWithOpacity(
      cornerLogoPath,
      cornerLogoWidth,
      CORNER_OPACITY,
    );

  const cornerMetadata =
    await sharp(
      cornerLogo,
    ).metadata();

  const margin =
    Math.round(
      imageWidth *
      CORNER_MARGIN,
    );

  const cornerLeft =
    Math.max(
      0,

      imageWidth -
        (
          cornerMetadata.width ??
          0
        ) -
        margin,
    );

  const cornerTop =
    Math.max(
      0,

      imageHeight -
        (
          cornerMetadata.height ??
          0
        ) -
        margin,
    );

  await fs.mkdir(
    path.dirname(
      outputPath,
    ),
    {
      recursive: true,
    },
  );

  await sharp(
    previewBuffer,
  )
    .composite([
      {
        input:
          centerLogo,

        gravity:
          "center",
      },

      {
        input:
          cornerLogo,

        left:
          cornerLeft,

        top:
          cornerTop,
      },
    ])
    .jpeg({
      quality:
        JPEG_QUALITY,

      mozjpeg:
        true,
    })
    .toFile(
      outputPath,
    );

  console.log(
    `✓ Nový náhľad: ${path.basename(outputPath)}`,
  );

  return true;
}

// =====================================================
// GALÉRIA
// =====================================================

async function processGallery(
  galleryDirectoryEntry,
) {
  const slug =
    galleryDirectoryEntry.name;

  const originalsDirectory =
    path.join(
      galleriesDirectory,
      slug,
      "originals",
    );

  if (
    !(await directoryExists(
      originalsDirectory,
    ))
  ) {
    console.log(
      `Preskočená galéria bez originals: ${slug}`,
    );

    return {
      local: 0,
      alreadyR2: 0,
      newPhotos: 0,
      created: 0,
    };
  }

  const directoryItems =
    await fs.readdir(
      originalsDirectory,
      {
        withFileTypes:
          true,
      },
    );

  const filenames =
    directoryItems
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
        (
          first,
          second,
        ) =>
          first.localeCompare(
            second,
            "sk",
            {
              numeric:
                true,
            },
          ),
      );

  if (
    filenames.length === 0
  ) {
    return {
      local: 0,
      alreadyR2: 0,
      newPhotos: 0,
      created: 0,
    };
  }

  console.log("");
  console.log(
    `Galéria: ${slug}`,
  );

  console.log(
    `Lokálne originály: ${filenames.length}`,
  );

  const remoteThumbnailSet =
    await listR2ThumbnailFilenames(
      slug,
    );

  const filenamesNeedingThumbnail =
    filenames.filter(
      (filename) =>
        !remoteThumbnailSet.has(
          filename,
        ),
    );

  const alreadyR2 =
    filenames.length -
    filenamesNeedingThumbnail.length;

  console.log(
    `Náhľady už na R2: ${alreadyR2}`,
  );

  console.log(
    `Nové náhľady potrebné: ${filenamesNeedingThumbnail.length}`,
  );

  if (
    filenamesNeedingThumbnail.length === 0
  ) {
    console.log(
      "✓ Nie je potrebné vytvoriť žiadny nový náhľad.",
    );

    return {
      local:
        filenames.length,

      alreadyR2,

      newPhotos: 0,

      created: 0,
    };
  }

  const outputDirectory =
    path.join(
      outputRoot,
      slug,
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  let createdCount = 0;

  for (
    const filename
    of filenamesNeedingThumbnail
  ) {
    const originalPath =
      path.join(
        originalsDirectory,
        filename,
      );

    const outputPath =
      path.join(
        outputDirectory,
        filename,
      );

    const created =
      await createPreview(
        originalPath,
        outputPath,
      );

    if (created) {
      createdCount += 1;
    }
  }

  console.log(
    `✓ ${createdCount} nových náhľadov pripravených.`,
  );

  return {
    local:
      filenames.length,

    alreadyR2,

    newPhotos:
      filenamesNeedingThumbnail.length,

    created:
      createdCount,
  };
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  validateSettings();

  if (
    !(await directoryExists(
      galleriesDirectory,
    ))
  ) {
    throw new Error(
      `Chýba priečinok: ${galleriesDirectory}`,
    );
  }

  await Promise.all([
    fs.access(
      centerLogoPath,
    ),

    fs.access(
      cornerLogoPath,
    ),
  ]);

  await fs.mkdir(
    outputRoot,
    {
      recursive: true,
    },
  );

  const galleryItems =
    await fs.readdir(
      galleriesDirectory,
      {
        withFileTypes:
          true,
      },
    );

  const galleryDirectories =
    galleryItems
      .filter(
        (item) =>
          item.isDirectory(),
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.name.localeCompare(
            second.name,
            "sk",
            {
              numeric:
                true,
            },
          ),
      );

  let totalLocal = 0;
  let totalAlreadyR2 = 0;
  let totalNeeded = 0;
  let totalCreated = 0;

  for (
    const galleryDirectory
    of galleryDirectories
  ) {
    const result =
      await processGallery(
        galleryDirectory,
      );

    totalLocal +=
      result.local;

    totalAlreadyR2 +=
      result.alreadyR2;

    totalNeeded +=
      result.newPhotos;

    totalCreated +=
      result.created;
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEDON. VODOZNAKY",
  );

  console.log(
    "==============================================",
  );

  console.log(
    `Lokálne originály: ${totalLocal}`,
  );

  console.log(
    `Náhľady už na R2: ${totalAlreadyR2}`,
  );

  console.log(
    `Nové náhľady potrebné: ${totalNeeded}`,
  );

  console.log(
    `Nové náhľady vytvorené: ${totalCreated}`,
  );

  console.log(
    `Výstup: ${outputRoot}`,
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "==============================================",
    );

    console.error(
      "CHYBA PRI VYTVÁRANÍ VODOZNAKOV",
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