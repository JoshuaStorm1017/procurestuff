import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_CONFIG } from "./config.js";
import { createDefaultState, normalizeState } from "./domain.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function dataFilePath() {
  return process.env[APP_CONFIG.dataEnv] || path.join(projectRoot, "data", APP_CONFIG.dataFile);
}

export async function readDb() {
  const filePath = dataFilePath();
  try {
    const text = await readFile(filePath, "utf8");
    return normalizeState(JSON.parse(text));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const seeded = createDefaultState();
    await writeDb(seeded);
    return seeded;
  }
}

export async function writeDb(state) {
  const filePath = dataFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`);
  await rename(tempPath, filePath);
}
