import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const projectRoot = process.cwd();

const galleriesDirectory = path.join(
  projectRoot,
  "storage",
  "galleries",
);

const configPath = path.join(
  projectRoot,
  "data",
  "galleries.config.json",
);

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.clear();

  console.log("");
  console.log("================================");
  console.log("LEDON. - ODSTRÁNENIE GALÉRIE");
  console.log("================================");

  const entries = await fs.readdir(
    galleriesDirectory,
    {
      withFileTypes: true,
    },
  );

  const galleries = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) =>
      a.localeCompare(b, "sk", {
        numeric: true,
      }),
    );

  if (galleries.length === 0) {
    console.log("");
    console.log("Nebola nájdená žiadna galéria.");
    return;
  }

  console.log("");

  galleries.forEach((gallery, index) => {
    console.log(`${index + 1}. ${gallery}`);
  });

  console.log("");

  const answer = await ask(
    "Vyber číslo galérie (0 = koniec): ",
  );

  const selected = Number(answer);

  if (
    Number.isNaN(selected) ||
    selected < 0 ||
    selected > galleries.length
  ) {
    console.log("");
    console.log("Neplatný výber.");
    return;
  }

  if (selected === 0) {
    console.log("");
    console.log("Operácia zrušená.");
    return;
  }

  const slug = galleries[selected - 1];

  console.log("");
  console.log(`Vybral si galériu:`);
  console.log(slug);

  console.log("");

  const confirm = await ask(
    'Pre potvrdenie napíš "ANO": ',
  );

  if (confirm !== "ANO") {
    console.log("");
    console.log("Operácia zrušená.");
    return;
  }

  const galleryPath = path.join(
  projectRoot,
  "storage",
  "galleries",
  slug,
);

const thumbsPath = path.join(
  projectRoot,
  "storage",
  "thumbs",
  slug,
);

console.log("");
console.log("Odstraňujem lokálne súbory...");

await fs.rm(galleryPath, {
  recursive: true,
  force: true,
});

await fs.rm(thumbsPath, {
  recursive: true,
  force: true,
});

console.log("✓ storage/galleries odstránené");
console.log("✓ storage/thumbs odstránené");

console.log("");
console.log("================================");
console.log("LOKÁLNA GALÉRIA ODSTRÁNENÁ");
console.log("================================");
console.log(slug);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});