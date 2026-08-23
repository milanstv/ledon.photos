import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// =====================================================
// NASTAVENIA VODOZNAKU
// Meníš iba hodnoty v tejto časti.
// =====================================================

// Veľké LD uprostred fotografie
const CENTER_OPACITY = 0.30; // 0.10 = 10 %, 0.30 = 30 %, 1.00 = 100 %
const CENTER_SIZE = 0.78; // 78 % šírky fotografie

// Malé logo LEDON. vpravo dole
const CORNER_OPACITY = 1.0; // 1.00 = 100 %
const CORNER_SIZE = 0.08; // 8 % šírky fotografie
const CORNER_MARGIN = 0.025; // 2,5 % od pravého a spodného okraja

// Výstupné náhľady
const MAX_IMAGE_SIZE = 2000;
const JPEG_QUALITY = 82;

// true = vždy vytvorí všetky náhľady znova
// false = vytvorí iba chýbajúce alebo zmenené náhľady
const FORCE_REBUILD = false;

// =====================================================
// CESTY
// Túto časť už nemusíš meniť.
// =====================================================

const projectRoot = process.cwd();

const currentScriptPath = fileURLToPath(import.meta.url);

const galleriesDirectory = path.join(
  projectRoot,
  "storage",
  "galleries",
);

const outputRoot = path.join(
  projectRoot,
  "storage",
  "thumbs",
);

const centerLogoPath = path.join(
  projectRoot,
  "public",
  "images",
  "LD-center.png",
);

const cornerLogoPath = path.join(
  projectRoot,
  "public",
  "images",
  "LEDON-logo-white-transparent.png",
);

const supportedExtensions = new Set([
  ".jpg",
  ".jpeg",
]);

// =====================================================
// POMOCNÉ FUNKCIE
// =====================================================

async function directoryExists(directoryPath) {
  try {
    const statistics = await fs.stat(directoryPath);
    return statistics.isDirectory();
  } catch {
    return false;
  }
}

function validateSettings() {
  const opacitySettings = [
    ["CENTER_OPACITY", CENTER_OPACITY],
    ["CORNER_OPACITY", CORNER_OPACITY],
  ];

  for (const [name, value] of opacitySettings) {
    if (value < 0 || value > 1) {
      throw new Error(
        `${name} musí byť číslo od 0 do 1.`,
      );
    }
  }

  const sizeSettings = [
    ["CENTER_SIZE", CENTER_SIZE],
    ["CORNER_SIZE", CORNER_SIZE],
    ["CORNER_MARGIN", CORNER_MARGIN],
  ];

  for (const [name, value] of sizeSettings) {
    if (value <= 0 || value > 1) {
      throw new Error(
        `${name} musí byť väčšie ako 0 a maximálne 1.`,
      );
    }
  }

  if (MAX_IMAGE_SIZE < 100) {
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

/*
 * Správne nastaví priehľadnosť PNG obrázka.
 * Mení iba alfa kanál, nie farby loga.
 */
async function createLogoWithOpacity(
  logoPath,
  width,
  opacity,
) {
  const {
    data,
    info,
  } = await sharp(logoPath)
    .resize({
      width,
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true,
    });

  const pixels = Buffer.from(data);

  for (
    let alphaIndex = 3;
    alphaIndex < pixels.length;
    alphaIndex += 4
  ) {
    pixels[alphaIndex] = Math.round(
      pixels[alphaIndex] * opacity,
    );
  }

  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function shouldCreatePreview(
  originalPath,
  outputPath,
) {
  if (FORCE_REBUILD) {
    return true;
  }

  try {
    const [
      originalStatistics,
      outputStatistics,
      centerLogoStatistics,
      cornerLogoStatistics,
      scriptStatistics,
    ] = await Promise.all([
      fs.stat(originalPath),
      fs.stat(outputPath),
      fs.stat(centerLogoPath),
      fs.stat(cornerLogoPath),
      fs.stat(currentScriptPath),
    ]);

    const newestSourceTime = Math.max(
      originalStatistics.mtimeMs,
      centerLogoStatistics.mtimeMs,
      cornerLogoStatistics.mtimeMs,
      scriptStatistics.mtimeMs,
    );

    return (
      outputStatistics.mtimeMs <
      newestSourceTime
    );
  } catch {
    return true;
  }
}

// =====================================================
// VYTVORENIE JEDNÉHO NÁHĽADU
// =====================================================

async function createPreview(
  originalPath,
  outputPath,
) {
  const mustCreate = await shouldCreatePreview(
    originalPath,
    outputPath,
  );

  if (!mustCreate) {
    console.log(
      `Preskočené: ${path.basename(originalPath)}`,
    );

    return false;
  }

  /*
   * Vytvorenie základného náhľadu.
   * rotate() správne použije orientáciu fotografie.
   */
  const {
    data: previewBuffer,
    info: previewInfo,
  } = await sharp(originalPath)
    .rotate()
    .resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer({
      resolveWithObject: true,
    });

  const imageWidth = previewInfo.width;
  const imageHeight = previewInfo.height;

  /*
   * Veľké stredové LD.
   */
  const centerLogoWidth = Math.max(
    1,
    Math.round(
      imageWidth * CENTER_SIZE,
    ),
  );

  const centerLogo = await createLogoWithOpacity(
    centerLogoPath,
    centerLogoWidth,
    CENTER_OPACITY,
  );

  /*
   * Malé logo LEDON. vpravo dole.
   */
  const cornerLogoWidth = Math.max(
    1,
    Math.round(
      imageWidth * CORNER_SIZE,
    ),
  );

  const cornerLogo =
    await createLogoWithOpacity(
      cornerLogoPath,
      cornerLogoWidth,
      CORNER_OPACITY,
    );

  const cornerMetadata = await sharp(
    cornerLogo,
  ).metadata();

  const margin = Math.round(
    imageWidth * CORNER_MARGIN,
  );

  const cornerLeft = Math.max(
    0,
    imageWidth -
      (cornerMetadata.width ?? 0) -
      margin,
  );

  const cornerTop = Math.max(
    0,
    imageHeight -
      (cornerMetadata.height ?? 0) -
      margin,
  );

  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true,
    },
  );

  await sharp(previewBuffer)
    .composite([
      {
        input: centerLogo,
        gravity: "center",
      },
      {
        input: cornerLogo,
        left: cornerLeft,
        top: cornerTop,
      },
    ])
    .jpeg({
      quality: JPEG_QUALITY,
      mozjpeg: true,
    })
    .toFile(outputPath);

  console.log(
    `Vytvorený náhľad: ${path.basename(outputPath)}`,
  );

  return true;
}

// =====================================================
// SPRACOVANIE GALÉRIE
// =====================================================

async function processGallery(
  galleryDirectoryEntry,
) {
  const slug = galleryDirectoryEntry.name;

  const originalsDirectory = path.join(
    galleriesDirectory,
    slug,
    "originals",
  );

  if (
    !(await directoryExists(originalsDirectory))
  ) {
    console.log(
      `Preskočená galéria bez originals: ${slug}`,
    );

    return {
      total: 0,
      created: 0,
    };
  }

  const outputDirectory = path.join(
    outputRoot,
    slug,
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const directoryItems = await fs.readdir(
    originalsDirectory,
    {
      withFileTypes: true,
    },
  );

  const filenames = directoryItems
    .filter((item) => item.isFile())
    .map((item) => item.name)
    .filter((filename) =>
      supportedExtensions.has(
        path.extname(filename).toLowerCase(),
      ),
    )
    .sort((first, second) =>
      first.localeCompare(second, "sk", {
        numeric: true,
      }),
    );

  console.log("");
  console.log(`Galéria: ${slug}`);

  let createdCount = 0;

  for (const filename of filenames) {
    const originalPath = path.join(
      originalsDirectory,
      filename,
    );

    const outputPath = path.join(
      outputDirectory,
      filename,
    );

    const created = await createPreview(
      originalPath,
      outputPath,
    );

    if (created) {
      createdCount += 1;
    }
  }

  console.log(
    `${slug}: ${filenames.length} fotografií, ` +
      `${createdCount} vytvorených náhľadov`,
  );

  return {
    total: filenames.length,
    created: createdCount,
  };
}

// =====================================================
// SPUSTENIE
// =====================================================

async function main() {
  validateSettings();

  if (
    !(await directoryExists(galleriesDirectory))
  ) {
    throw new Error(
      `Chýba priečinok: ${galleriesDirectory}`,
    );
  }

  await Promise.all([
    fs.access(centerLogoPath),
    fs.access(cornerLogoPath),
  ]);

  await fs.mkdir(outputRoot, {
    recursive: true,
  });

  const galleryItems = await fs.readdir(
    galleriesDirectory,
    {
      withFileTypes: true,
    },
  );

  /*
   * Spracujú sa iba skutočné priečinky.
   * Súbory ako .DS_Store sa automaticky ignorujú.
   */
  const galleryDirectories = galleryItems
    .filter((item) => item.isDirectory())
    .sort((first, second) =>
      first.name.localeCompare(
        second.name,
        "sk",
        {
          numeric: true,
        },
      ),
    );

  let totalPhotos = 0;
  let totalCreated = 0;

  for (
    const galleryDirectory
    of galleryDirectories
  ) {
    const result = await processGallery(
      galleryDirectory,
    );

    totalPhotos += result.total;
    totalCreated += result.created;
  }

  console.log("");
  console.log("================================");
  console.log("VODOZNAKY HOTOVÉ");
  console.log("================================");
  console.log(
    `Nájdených fotografií: ${totalPhotos}`,
  );
  console.log(
    `Vytvorených náhľadov: ${totalCreated}`,
  );
  console.log(`Výstup: ${outputRoot}`);
}

main().catch((error) => {
  console.error("");
  console.error(
    "CHYBA PRI VYTVÁRANÍ VODOZNAKOV:",
  );
  console.error(error?.message ?? error);
  process.exit(1);
});