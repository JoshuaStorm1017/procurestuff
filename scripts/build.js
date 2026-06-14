import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_CONFIG } from "../server/config.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = {
  product: APP_CONFIG.slug,
  builtAt: new Date().toISOString(),
  publicFiles: ["index.html", "styles.css", "app.js"],
  api: ["/api/state", "/api/export/all.json", "/api/import", "/api/workspace", "/api/actions/:action"]
};

await mkdir(path.join(rootDir, "dist"), { recursive: true });
await writeFile(path.join(rootDir, "dist", "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${APP_CONFIG.name} build manifest written.`);
