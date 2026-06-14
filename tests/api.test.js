import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { APP_CONFIG } from "../server/config.js";
import { handleApi } from "../server/routes.js";

test("API state and create routes work without opening a socket", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `${APP_CONFIG.slug}-`));
  process.env[APP_CONFIG.dataEnv] = path.join(tempDir, "data.json");
  try {
    const stateResponse = await callApi("GET", "/api/state");
    assert.equal(stateResponse.status, 200);
    assert.ok(stateResponse.body.config.name);

    const primary = APP_CONFIG.collections.find((collection) => collection.key === APP_CONFIG.primaryCollection);
    const source = stateResponse.body[primary.key][0];
    const copyName = `${source[primary.displayField]} API copy`;
    const createResponse = await callApi("POST", `/api/${primary.key}`, { ...source, [primary.displayField]: copyName, sourceUri: source.sourceUri || "/mnt/api-copy.jpg" });
    assert.equal(createResponse.status, 201);
    assert.ok(createResponse.body[primary.key].some((row) => row[primary.displayField] === copyName));

    const exportResponse = await callApi("GET", `/api/export/${primary.key}.csv`);
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.text, /API copy/);
  } finally {
    delete process.env[APP_CONFIG.dataEnv];
    await rm(tempDir, { recursive: true, force: true });
  }
});

async function callApi(method, pathname, body) {
  const req = new MockRequest(method, body);
  const res = new MockResponse();
  await handleApi(req, res, new URL(pathname, "http://local.test"));
  return {
    status: res.status,
    headers: res.headers,
    text: res.text,
    body: parseJson(res.text)
  };
}

class MockRequest extends Readable {
  constructor(method, body) {
    super();
    this.method = method;
    this.headers = { host: "local.test" };
    this.bodyText = body ? JSON.stringify(body) : "";
    this.sent = false;
  }

  _read() {
    if (this.sent) return this.push(null);
    this.sent = true;
    this.push(this.bodyText);
  }
}

class MockResponse {
  constructor() {
    this.status = 200;
    this.headers = {};
    this.text = "";
  }

  writeHead(status, headers = {}) {
    this.status = status;
    this.headers = headers;
  }

  end(chunk = "") {
    this.text += chunk;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
