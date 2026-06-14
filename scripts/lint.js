import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDirs = new Set([".git", "node_modules", "dist", "data"]);
const extensions = new Set([".js", ".css", ".html", ".md", ".json"]);
const markers = [
  "TO" + "DO",
  "place" + "holder",
  "mock" + "-only",
  "disabled" + " button",
  "lorem" + " ipsum",
  "fake" + " chart",
  "fake" + " API",
  "stu" + "b"
];

const findings = [];
for await (const filePath of walk(rootDir)) {
  if (!extensions.has(path.extname(filePath))) continue;
  const text = await readFile(filePath, "utf8");
  const lower = text.toLowerCase();
  for (const marker of markers) {
    if (lower.includes(marker.toLowerCase())) findings.push(`${path.relative(rootDir, filePath)} contains ${marker}`);
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Source lint scan passed.");

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) yield* walk(filePath);
    } else {
      yield filePath;
    }
  }
}
