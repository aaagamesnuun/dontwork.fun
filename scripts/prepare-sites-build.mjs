import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import { resolve } from "node:path";

const clientDirectory = resolve("dist/client");
const serverDirectory = resolve("dist/server");
const migrationDirectory = resolve("dist/.openai/drizzle");

await mkdir(clientDirectory, { recursive: true });
for (const name of await readdir(resolve("dist"))) {
  if (["client", "server", ".openai"].includes(name)) continue;
  await rename(resolve("dist", name), resolve(clientDirectory, name));
}
await import("./generate-pwa.mjs");
// /play is a direct, same-origin entry point outside the v1.8 worker's broken
// root-navigation handler. It starts the game and fetches the repairing worker
// without asking players to clear saved data or win a reload/update race.
await copyFile(
  resolve(clientDirectory, "index.html"),
  resolve(clientDirectory, "play.html"),
);

await mkdir(serverDirectory, { recursive: true });
await copyFile(
  resolve("server/worker.js"),
  resolve(serverDirectory, "index.js"),
);

await copyFile(
  resolve("server/rankings.js"),
  resolve(serverDirectory, "rankings.js"),
);

await copyFile(resolve("server/soundExperiment.js"), resolve(serverDirectory,"soundExperiment.js"));

await mkdir(migrationDirectory, { recursive: true });
const migrations = (await readdir(resolve("drizzle")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const migration of migrations) {
  await copyFile(
    resolve("drizzle", migration),
    resolve(migrationDirectory, migration),
  );
}

await copyFile(resolve('server/bankrollRankings.js'),resolve(serverDirectory,'bankrollRankings.js'));
