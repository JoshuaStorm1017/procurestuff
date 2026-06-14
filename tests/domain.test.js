import assert from "node:assert/strict";
import test from "node:test";
import { APP_CONFIG } from "../server/config.js";
import {
  applyWorkflowAction,
  archiveEntity,
  createDefaultState,
  createEntity,
  exportSnapshot,
  shapeState,
  toCsv,
  updateWorkspace
} from "../server/domain.js";

test("seeded state computes dashboard metrics from persisted rows", () => {
  const state = createDefaultState();
  const shaped = shapeState(state);
  const metricKeys = Object.keys(shaped.analytics.metrics);
  assert.equal(metricKeys.length, APP_CONFIG.metrics.length);
  assert.ok(shaped.analytics.metrics[metricKeys[0]] >= 0);
  assert.ok(shaped[APP_CONFIG.primaryCollection].length >= 3);
});

test("required field validation protects entity creation", () => {
  const state = createDefaultState();
  const result = createEntity(state, APP_CONFIG.primaryCollection, {});
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("create, workflow action, and archive mutate persisted shape", () => {
  const state = createDefaultState();
  const primary = APP_CONFIG.collections.find((collection) => collection.key === APP_CONFIG.primaryCollection);
  const source = state[primary.key][0];
  const result = createEntity(state, primary.key, { ...source, title: `${source.title} copy`, sourceUri: "/mnt/brand/new-copy.jpg" });
  assert.equal(result.ok, true);
  const created = state[primary.key].at(-1);
  const action = APP_CONFIG.actions.find((item) => item.collection === primary.key);
  const beforeAction = created[action.field];
  const actionResult = applyWorkflowAction(state, action.key, { id: created.id });
  assert.equal(actionResult.ok, true);
  if ("value" in action) assert.equal(created[action.field], action.value);
  else assert.notEqual(created[action.field], beforeAction);
  const archiveResult = archiveEntity(state, primary.key, created.id);
  assert.equal(archiveResult.ok, true);
  assert.ok(created.archivedAt);
});

test("workspace updates are validated and logged", () => {
  const state = createDefaultState();
  const result = updateWorkspace(state, { ...state.workspace, organizationName: "Updated Ops" });
  assert.equal(result.ok, true);
  assert.equal(state.workspace.organizationName, "Updated Ops");
  assert.equal(state.activity[0].action, "updated workspace");
});

test("CSV and JSON snapshot exports include operational data", () => {
  const state = createDefaultState();
  const csv = toCsv(state[APP_CONFIG.primaryCollection]);
  assert.match(csv, /id,/);
  const snapshot = exportSnapshot(state);
  assert.equal(snapshot.product, APP_CONFIG.slug);
  assert.ok(snapshot[APP_CONFIG.primaryCollection].length > 0);
});
