import { spawnSync } from "node:child_process";

const npmCommand =
  process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, argumentsList) {
  console.log("");
  console.log(`▶ ${command} ${argumentsList.join(" ")}`);
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
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("");
    console.error(
      `❌ Príkaz zlyhal: ${command} ${argumentsList.join(" ")}`,
    );
    process.exit(result.status ?? 1);
  }
}

console.log("");
console.log("================================");
console.log("PUBLIKOVANIE GALÉRIE LEDON.");
console.log("================================");

run(npmCommand, ["run", "watermark"]);
run(npmCommand, ["run", "gallery"]);
run(npmCommand, ["run", "build"]);

run("git", ["add", "."]);

const changes = spawnSync(
  "git",
  ["diff", "--cached", "--quiet"],
  {
    stdio: "inherit",
  },
);

if (changes.status === 0) {
  console.log("");
  console.log("ℹ️ V Gite nie sú žiadne nové zmeny.");
  console.log("R2 a kontrola webu boli dokončené.");
  process.exit(0);
}

const date = new Date()
  .toISOString()
  .slice(0, 10);

run("git", [
  "commit",
  "-m",
  `Aktualizácia galérií ${date}`,
]);

run("git", ["push"]);

console.log("");
console.log("================================");
console.log("✅ GALÉRIA BOLA PUBLIKOVANÁ");
console.log("================================");
console.log("Vercel teraz nasadí novú verziu webu.");