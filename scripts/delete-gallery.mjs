import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const projectRoot = process.cwd();

const galleriesDirectory = path.join(
  projectRoot,
  "storage",
  "galleries",
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

  console.log("");
  console.log("================================");
  console.log("GALÉRIA PRIPRAVENÁ NA ODSTRÁNENIE");
  console.log("================================");
  console.log(slug);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});