import {
  APP_CONFIG
} from "./config.js";
import {
  applyWorkflowAction,
  archiveEntity,
  collectionKeys,
  createEntity,
  exportSnapshot,
  getCollectionConfig,
  importSnapshot,
  shapeState,
  toCsv,
  updateEntity,
  updateWorkspace,
  restoreEntity
} from "./domain.js";
import { readDb, writeDb } from "./store.js";

const collectionSet = new Set(collectionKeys());

export async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      return sendJson(res, 200, shapeState(await readDb()));
    }

    if (req.method === "GET" && url.pathname === "/api/export/all.json") {
      const db = await readDb();
      return download(res, `${APP_CONFIG.slug}-workspace.json`, "application/json", `${JSON.stringify(exportSnapshot(db), null, 2)}\n`);
    }

    const exportMatch = url.pathname.match(/^\/api\/export\/([a-zA-Z0-9]+)\.(json|csv)$/);
    if (req.method === "GET" && exportMatch) {
      const [, collectionKey, format] = exportMatch;
      if (!collectionSet.has(collectionKey)) return sendJson(res, 400, { errors: ["Export collection is not supported."] });
      const db = await readDb();
      const rows = db[collectionKey] || [];
      if (format === "json") return download(res, `${APP_CONFIG.slug}-${collectionKey}.json`, "application/json", `${JSON.stringify(rows, null, 2)}\n`);
      return download(res, `${APP_CONFIG.slug}-${collectionKey}.csv`, "text/csv", toCsv(rows));
    }

    if (req.method === "POST" && url.pathname === "/api/import") {
      return mutate(res, async (db) => importSnapshot(db, await readJson(req)));
    }

    if (req.method === "PATCH" && url.pathname === "/api/workspace") {
      return mutate(res, async (db) => updateWorkspace(db, await readJson(req)));
    }

    const actionMatch = url.pathname.match(/^\/api\/actions\/([^/]+)$/);
    if (req.method === "POST" && actionMatch) {
      return mutate(res, async (db) => applyWorkflowAction(db, actionMatch[1], await readJson(req)));
    }

    const collectionRoot = url.pathname.match(/^\/api\/([a-zA-Z0-9]+)$/);
    if (collectionRoot && req.method === "POST" && collectionSet.has(collectionRoot[1])) {
      return mutate(res, async (db) => createEntity(db, collectionRoot[1], await readJson(req)));
    }

    const itemMatch = url.pathname.match(/^\/api\/([a-zA-Z0-9]+)\/([^/]+)(?:\/(archive|restore))?$/);
    if (itemMatch && collectionSet.has(itemMatch[1])) {
      const [, collectionKey, id, operation] = itemMatch;
      if (req.method === "PATCH" && !operation) return mutate(res, async (db) => updateEntity(db, collectionKey, id, await readJson(req)));
      if (req.method === "POST" && operation === "archive") return mutate(res, async (db) => archiveEntity(db, collectionKey, id));
      if (req.method === "POST" && operation === "restore") return mutate(res, async (db) => restoreEntity(db, collectionKey, id));
      if (req.method === "GET" && !operation) {
        const db = await readDb();
        const row = (db[collectionKey] || []).find((item) => item.id === id);
        if (!row) return sendJson(res, 404, { errors: [`${getCollectionConfig(collectionKey).singular} was not found.`] });
        return sendJson(res, 200, row);
      }
    }

    return sendJson(res, 404, { errors: ["Route was not found."] });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { errors: ["Unexpected server error."] });
  }
}

export async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload)}\n`);
}

async function mutate(res, mutator) {
  const db = await readDb();
  const result = await mutator(db);
  if (!result.ok) return sendJson(res, result.status || 400, { errors: result.errors });
  await writeDb(db);
  return sendJson(res, result.status || 200, result.value);
}

function download(res, filename, contentType, body) {
  res.writeHead(200, {
    "content-type": `${contentType}; charset=utf-8`,
    "content-disposition": `attachment; filename="${filename}"`
  });
  res.end(body);
}
