import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const projectRoot = process.cwd();

const galleriesDirectory = path.join(
  projectRoot,
  "storage",
  "galleries",
);

const thumbsDirectory = path.join(
  projectRoot,
  "storage",
  "thumbs",
);

const configPath = path.join(
  projectRoot,
  "data",
  "galleries.config.json",
);

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

const requiredEnvironmentVariables = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ORIGINALS_BUCKET",
  "R2_THUMBS_BUCKET",
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

function run(command, argumentsList) {
  console.log("");
  console.log(
    `▶ ${command} ${argumentsList.join(" ")}`,
  );
  console.log("");

  const result = spawnSync(
    command,
    argumentsList,
    {
      stdio: "inherit",
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Príkaz zlyhal: ${command} ${argumentsList.join(" ")}`,
    );
  }
}

async function directoryExists(
  directoryPath,
) {
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

async function loadConfiguration() {
  if (!(await fileExists(configPath))) {
    return [];
  }

  const content = await fs.readFile(
    configPath,
    "utf8",
  );

  const configuration = JSON.parse(content);

  if (!Array.isArray(configuration)) {
    throw new Error(
      "galleries.config.json musí obsahovať pole.",
    );
  }

  return configuration;
}

async function loadLocalGallerySlugs() {
  if (
    !(await directoryExists(
      galleriesDirectory,
    ))
  ) {
    return [];
  }

  const entries = await fs.readdir(
    galleriesDirectory,
    {
      withFileTypes: true,
    },
  );

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function countLocalPhotos(slug) {
  const originalsPath = path.join(
    galleriesDirectory,
    slug,
    "originals",
  );

  if (
    !(await directoryExists(originalsPath))
  ) {
    return 0;
  }

  const entries = await fs.readdir(
    originalsPath,
    {
      withFileTypes: true,
    },
  );

  return entries.filter((entry) => {
    if (!entry.isFile()) {
      return false;
    }

    const extension = path
      .extname(entry.name)
      .toLowerCase();

    return (
      extension === ".jpg" ||
      extension === ".jpeg"
    );
  }).length;
}

async function createGalleryList() {
  const configuration =
    await loadConfiguration();

  const localSlugs =
    await loadLocalGallerySlugs();

  const configurationBySlug = new Map(
    configuration.map((gallery) => [
      gallery.slug,
      gallery,
    ]),
  );

  const allSlugs = new Set([
    ...localSlugs,
    ...configuration.map(
      (gallery) => gallery.slug,
    ),
  ]);

  const galleries = [];

  for (const slug of allSlugs) {
    const configurationEntry =
      configurationBySlug.get(slug);

    galleries.push({
      slug,
      title:
        configurationEntry?.title ?? slug,
      date:
        configurationEntry?.date ?? "",
      photoCount:
        await countLocalPhotos(slug),
    });
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

  return {
    galleries,
    configuration,
  };
}

async function deleteR2Prefix({
  bucket,
  prefix,
  label,
}) {
  let continuationToken;
  let deletedCount = 0;

  do {
    const listResponse =
      await r2Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
          MaxKeys: 1000,
        }),
      );

    const objects =
      listResponse.Contents ?? [];

    if (objects.length > 0) {
      const objectIdentifiers = objects
        .filter((object) => object.Key)
        .map((object) => ({
          Key: object.Key,
        }));

      if (
        objectIdentifiers.length > 0
      ) {
        const deleteResponse =
          await r2Client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: {
                Objects:
                  objectIdentifiers,
                Quiet: true,
              },
            }),
          );

        if (
          deleteResponse.Errors &&
          deleteResponse.Errors.length > 0
        ) {
          const errorText =
            deleteResponse.Errors
              .map(
                (error) =>
                  `${error.Key}: ` +
                  `${error.Message ?? error.Code}`,
              )
              .join("\n");

          throw new Error(
            `R2 nevymazalo všetky súbory:\n${errorText}`,
          );
        }

        deletedCount +=
          objectIdentifiers.length;
      }
    }

    continuationToken =
      listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
  } while (continuationToken);

  console.log(
    `✓ ${label}: ${deletedCount} súborov`,
  );

  return deletedCount;
}

async function removeLocalGallery(slug) {
  const galleryPath = path.join(
    galleriesDirectory,
    slug,
  );

  const thumbsPath = path.join(
    thumbsDirectory,
    slug,
  );

  await fs.rm(galleryPath, {
    recursive: true,
    force: true,
  });

  await fs.rm(thumbsPath, {
    recursive: true,
    force: true,
  });

  console.log(
    "✓ Lokálne originály odstránené",
  );

  console.log(
    "✓ Lokálne náhľady odstránené",
  );
}

async function updateConfiguration(
  configuration,
  slug,
) {
  const updatedConfiguration =
    configuration.filter(
      (gallery) => gallery.slug !== slug,
    );

  await fs.mkdir(
    path.dirname(configPath),
    {
      recursive: true,
    },
  );

  await fs.writeFile(
    configPath,
    JSON.stringify(
      updatedConfiguration,
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    "✓ galleries.config.json aktualizovaný",
  );
}

function commitAndPush(slug) {
  run("git", ["add", "."]);

  const changes = spawnSync(
    "git",
    [
      "diff",
      "--cached",
      "--quiet",
    ],
    {
      stdio: "inherit",
      shell: false,
    },
  );

  if (changes.error) {
    throw changes.error;
  }

  if (changes.status === 0) {
    console.log("");
    console.log(
      "ℹ️ V Gite nie sú žiadne nové zmeny.",
    );
    return;
  }

  if (changes.status !== 1) {
    throw new Error(
      "Nepodarilo sa skontrolovať zmeny v Gite.",
    );
  }

  run("git", [
    "commit",
    "-m",
    `Odstránenie galérie ${slug}`,
  ]);

  run("git", ["push"]);
}

async function main() {
  const readlineInterface =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

  try {
    console.log("");
    console.log(
      "================================",
    );
    console.log(
      "LEDON. - ODSTRÁNENIE GALÉRIE",
    );
    console.log(
      "================================",
    );

    const {
      galleries,
      configuration,
    } = await createGalleryList();

    if (galleries.length === 0) {
      console.log("");
      console.log(
        "Nebola nájdená žiadna galéria.",
      );
      return;
    }

    console.log("");

    galleries.forEach(
      (gallery, index) => {
        const dateText = gallery.date
          ? ` – ${gallery.date}`
          : "";

        const photoText =
          gallery.photoCount > 0
            ? ` (${gallery.photoCount} fotografií)`
            : " (lokálne súbory už neexistujú)";

        console.log(
          `${index + 1}. ` +
          `${gallery.title}` +
          `${dateText}` +
          `${photoText}`,
        );

        console.log(
          `   ${gallery.slug}`,
        );
      },
    );

    console.log("");
    console.log(
      "0. Zrušiť operáciu",
    );
    console.log("");

    const selectionAnswer =
      await readlineInterface.question(
        "Vyber číslo galérie: ",
      );

    const selectedNumber = Number(
      selectionAnswer.trim(),
    );

    if (
      !Number.isInteger(selectedNumber) ||
      selectedNumber < 0 ||
      selectedNumber > galleries.length
    ) {
      throw new Error(
        "Neplatný výber galérie.",
      );
    }

    if (selectedNumber === 0) {
      console.log("");
      console.log("Operácia zrušená.");
      return;
    }

    const selectedGallery =
      galleries[selectedNumber - 1];

    console.log("");
    console.log(
      "Galéria bude natrvalo odstránená:",
    );
    console.log(
      selectedGallery.title,
    );
    console.log(
      selectedGallery.slug,
    );
    console.log("");

    const confirmation =
      await readlineInterface.question(
        'Pre potvrdenie napíš presne "ANO": ',
      );

    if (
      confirmation.trim() !== "ANO"
    ) {
      console.log("");
      console.log("Operácia zrušená.");
      return;
    }

    const prefix =
      `${selectedGallery.slug}/`;

    console.log("");
    console.log(
      "Odstraňujem súbory z R2...",
    );

    await deleteR2Prefix({
      bucket:
        process.env.R2_ORIGINALS_BUCKET,
      prefix,
      label: "R2 originály",
    });

    await deleteR2Prefix({
      bucket:
        process.env.R2_THUMBS_BUCKET,
      prefix,
      label: "R2 náhľady",
    });

    console.log("");
    console.log(
      "Odstraňujem lokálne súbory...",
    );

    await removeLocalGallery(
      selectedGallery.slug,
    );

    await updateConfiguration(
      configuration,
      selectedGallery.slug,
    );

    run(npmCommand, [
      "run",
      "gallery",
    ]);

    run(npmCommand, [
      "run",
      "build",
    ]);

    commitAndPush(
      selectedGallery.slug,
    );

    console.log("");
    console.log(
      "================================",
    );
    console.log(
      "✅ GALÉRIA BOLA ODSTRÁNENÁ",
    );
    console.log(
      "================================",
    );
    console.log(
      selectedGallery.slug,
    );
    console.log("");
    console.log(
      "Vercel teraz nasadí novú verziu webu.",
    );
  } finally {
    readlineInterface.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ CHYBA PRI ODSTRAŇOVANÍ GALÉRIE:",
  );
  console.error(
    error?.message ?? error,
  );
  process.exit(1);
});