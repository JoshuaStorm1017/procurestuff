import { APP_CONFIG } from "./config.js";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clean(value) {
  return String(value ?? "").trim();
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function publicConfig() {
  const { seeds: _seeds, ...rest } = APP_CONFIG;
  return clone(rest);
}

export function collectionKeys() {
  return APP_CONFIG.collections.map((collection) => collection.key);
}

export function getCollectionConfig(key) {
  const config = APP_CONFIG.collections.find((collection) => collection.key === key);
  if (!config) throw new Error(`Unknown collection: ${key}`);
  return config;
}

export function createDefaultState() {
  const state = clone(APP_CONFIG.seeds);
  for (const collection of APP_CONFIG.collections) {
    state[collection.key] = Array.isArray(state[collection.key]) ? state[collection.key] : [];
  }
  state.activity = Array.isArray(state.activity) ? state.activity : [];
  state.workspace = state.workspace || { id: `workspace_${APP_CONFIG.slug}` };
  state.session = state.session || { userId: "usr_local", userName: "Local Admin", role: "admin" };
  return state;
}

export function normalizeState(input) {
  const base = createDefaultState();
  const state = { ...base, ...clone(input || {}) };
  state.workspace = { ...base.workspace, ...(input?.workspace || {}) };
  state.session = { ...base.session, ...(input?.session || {}) };
  for (const collection of APP_CONFIG.collections) {
    state[collection.key] = Array.isArray(input?.[collection.key]) ? input[collection.key] : base[collection.key];
  }
  state.activity = Array.isArray(input?.activity) ? input.activity : base.activity;
  return state;
}

export function activeRows(state, collectionKey) {
  return (state[collectionKey] || []).filter((row) => !row.archivedAt);
}

export function addActivity(state, action, entityType, entityId, metadata = {}) {
  state.activity.unshift({
    id: uid("act"),
    actor: state.session?.userName || "Local Admin",
    action,
    entityType,
    entityId,
    metadata,
    createdAt: nowIso()
  });
  state.activity = state.activity.slice(0, 300);
}

export function validateWorkspace(input) {
  const value = {};
  const errors = [];
  for (const field of APP_CONFIG.workspaceFields) {
    value[field.name] = normalizeField(field, input?.[field.name], null, createDefaultState(), errors);
    if (field.required && isEmptyValue(value[field.name])) errors.push(`${field.label} is required.`);
  }
  return result(errors, value);
}

export function updateWorkspace(state, patch) {
  const validation = validateWorkspace({ ...state.workspace, ...patch });
  if (!validation.ok) return validation;
  state.workspace = { ...state.workspace, ...validation.value, updatedAt: nowIso() };
  addActivity(state, "updated workspace", "workspace", state.workspace.id, { organizationName: state.workspace.organizationName });
  return result([], shapeState(state));
}

export function validateEntity(state, collectionKey, input, existing = null) {
  const collection = getCollectionConfig(collectionKey);
  const errors = [];
  const value = {};
  for (const field of collection.fields) {
    const raw = input?.[field.name] ?? existing?.[field.name] ?? field.default ?? "";
    value[field.name] = normalizeField(field, raw, collectionKey, state, errors);
    if (field.required && isEmptyValue(value[field.name])) errors.push(`${field.label} is required.`);
  }
  return result(errors, value);
}

export function createEntity(state, collectionKey, input) {
  const collection = getCollectionConfig(collectionKey);
  const validation = validateEntity(state, collectionKey, input);
  if (!validation.ok) return validation;
  const row = {
    id: uid(collection.prefix),
    ...validation.value,
    archivedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state[collectionKey].push(row);
  addActivity(state, `created ${collection.singular.toLowerCase()}`, collectionKey, row.id, rowSummary(collection, row));
  return result([], shapeState(state), 201);
}

export function updateEntity(state, collectionKey, id, input) {
  const collection = getCollectionConfig(collectionKey);
  const row = findRow(state, collectionKey, id);
  if (!row) return result([`${collection.singular} was not found.`]);
  const validation = validateEntity(state, collectionKey, input, row);
  if (!validation.ok) return validation;
  Object.assign(row, validation.value, { updatedAt: nowIso() });
  addActivity(state, `updated ${collection.singular.toLowerCase()}`, collectionKey, row.id, rowSummary(collection, row));
  return result([], shapeState(state));
}

export function archiveEntity(state, collectionKey, id) {
  const collection = getCollectionConfig(collectionKey);
  const row = findRow(state, collectionKey, id);
  if (!row) return result([`${collection.singular} was not found.`]);
  row.archivedAt = nowIso();
  row.updatedAt = nowIso();
  addActivity(state, `archived ${collection.singular.toLowerCase()}`, collectionKey, row.id, rowSummary(collection, row));
  return result([], shapeState(state));
}

export function restoreEntity(state, collectionKey, id) {
  const collection = getCollectionConfig(collectionKey);
  const row = (state[collectionKey] || []).find((item) => item.id === id);
  if (!row) return result([`${collection.singular} was not found.`]);
  row.archivedAt = null;
  row.updatedAt = nowIso();
  addActivity(state, `restored ${collection.singular.toLowerCase()}`, collectionKey, row.id, rowSummary(collection, row));
  return result([], shapeState(state));
}

export function applyWorkflowAction(state, actionKey, payload = {}) {
  const action = APP_CONFIG.actions.find((item) => item.key === actionKey);
  if (!action) return result(["Workflow action is not supported."]);
  const collection = getCollectionConfig(action.collection);
  const row = findRow(state, action.collection, clean(payload.id));
  if (!row) return result([`${collection.singular} was not found.`]);
  if (action.type === "nextOption") {
    const field = collection.fields.find((item) => item.name === action.field);
    const options = field?.options || [];
    const index = Math.max(0, options.indexOf(row[action.field]));
    row[action.field] = options[Math.min(index + 1, options.length - 1)] || row[action.field];
  } else if (action.type === "increment") {
    row[action.field] = Number(row[action.field] || 0) + Number(action.amount || 1);
  } else {
    row[action.field] = action.value;
  }
  if (action.noteField && clean(payload.note)) row[action.noteField] = clean(payload.note);
  row.updatedAt = nowIso();
  addActivity(state, action.activity, action.collection, row.id, rowSummary(collection, row));
  return result([], shapeState(state));
}

export function computeAnalytics(state) {
  const metrics = {};
  for (const metric of APP_CONFIG.metrics) {
    metrics[metric.key] = computeMetric(state, metric);
  }
  const primary = getCollectionConfig(APP_CONFIG.primaryCollection);
  const rows = activeRows(state, primary.key);
  return {
    metrics,
    primaryBreakdown: countBy(rows, primary.fields.find((field) => field.name === "status") ? "status" : primary.fields[0].name),
    activity: [...state.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
  };
}

export function shapeState(state) {
  const normalized = normalizeState(state);
  return {
    ...clone(normalized),
    analytics: computeAnalytics(normalized),
    config: publicConfig()
  };
}

export function toCsv(rows) {
  const normalizedRows = rows.map((row) => flatten(row));
  const columns = Array.from(normalizedRows.reduce((set, row) => {
    for (const key of Object.keys(row)) set.add(key);
    return set;
  }, new Set()));
  if (!columns.length) return "\n";
  const lines = [columns.join(",")];
  for (const row of normalizedRows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function exportSnapshot(state) {
  const snapshot = clone(normalizeState(state));
  snapshot.exportedAt = nowIso();
  snapshot.product = APP_CONFIG.slug;
  return snapshot;
}

export function importSnapshot(state, snapshot) {
  const incoming = normalizeState(snapshot);
  for (const collectionKey of collectionKeys()) state[collectionKey] = incoming[collectionKey];
  state.workspace = incoming.workspace;
  state.session = { ...state.session, ...incoming.session };
  state.activity = incoming.activity;
  addActivity(state, "imported workspace snapshot", "workspace", state.workspace.id, { product: APP_CONFIG.slug });
  return result([], shapeState(state));
}

function computeMetric(state, metric) {
  const rows = activeRows(state, metric.collection);
  if (metric.type === "count") return rows.length;
  if (metric.type === "countWhere") return rows.filter((row) => matchesWhere(row, metric.where)).length;
  if (metric.type === "dueSoon") {
    const now = startOfToday();
    const limit = now + Number(metric.days || 30) * 86400000;
    return rows.filter((row) => {
      const time = dateTime(row[metric.dateField]);
      return Number.isFinite(time) && time >= now && time <= limit;
    }).length;
  }
  if (metric.type === "overdue") {
    const now = startOfToday();
    return rows.filter((row) => {
      const time = dateTime(row[metric.dateField]);
      return Number.isFinite(time) && time < now;
    }).length;
  }
  if (metric.type === "sum") {
    return rows.reduce((sum, row) => sum + Number(row[metric.field] || 0), 0);
  }
  if (metric.type === "percentWhere") {
    if (!rows.length) return 0;
    return Math.round((rows.filter((row) => matchesWhere(row, metric.where)).length / rows.length) * 100);
  }
  return 0;
}

function normalizeField(field, raw, currentCollection, state, errors) {
  if (field.type === "number") {
    const number = Number(raw ?? 0);
    if (!Number.isFinite(number)) {
      errors.push(`${field.label} must be a number.`);
      return 0;
    }
    return number;
  }
  if (field.type === "boolean") return raw === true || raw === "true" || raw === "on";
  if (field.type === "tags" || field.type === "multiselect") return arrayValue(raw).map(clean).filter(Boolean);
  if (field.type === "select") {
    const value = clean(raw);
    if (field.options.includes(value)) return value;
    return field.options[0] || "";
  }
  if (field.type === "date") {
    const value = clean(raw);
    if (!value) return "";
    if (!isoDatePattern.test(value)) errors.push(`${field.label} must use YYYY-MM-DD format.`);
    return value;
  }
  if (field.type === "email") {
    const value = clean(raw).toLowerCase();
    if (value && !emailPattern.test(value)) errors.push(`${field.label} must be a valid email address.`);
    return value;
  }
  if (field.type === "url") {
    const value = clean(raw);
    if (value && !isReasonableUrlOrPath(value)) errors.push(`${field.label} must be a URL or local path.`);
    return value;
  }
  if (field.type === "relation") {
    const value = clean(raw);
    if (!value) return "";
    const rows = activeRows(state, field.collection).filter((row) => row.id !== clean(state?.id));
    if (!rows.some((row) => row.id === value)) {
      const isSelfReferenceDuringSeed = currentCollection === field.collection && (state[field.collection] || []).some((row) => row.id === value);
      if (!isSelfReferenceDuringSeed) errors.push(`${field.label} must reference an active ${field.collection} record.`);
    }
    return value;
  }
  if (field.type === "relationMany") {
    const values = arrayValue(raw).map(clean).filter(Boolean);
    const allowed = new Set(activeRows(state, field.collection).map((row) => row.id));
    return values.filter((value) => allowed.has(value));
  }
  return clean(raw);
}

function result(errors, value = null, status = 200) {
  return errors.length ? { ok: false, errors, status: 400 } : { ok: true, value, status };
}

function findRow(state, collectionKey, id) {
  return activeRows(state, collectionKey).find((row) => row.id === id);
}

function rowSummary(collection, row) {
  return { [collection.displayField]: row[collection.displayField] || row.id };
}

function arrayValue(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

function isReasonableUrlOrPath(value) {
  return /^(https?:\/\/|file:\/\/|\/|\.\/|\.\.\/|[a-zA-Z]:\\)/.test(value);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dateTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : NaN;
}

function matchesWhere(row, where = {}) {
  for (const [field, expected] of Object.entries(where)) {
    const actual = row[field];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (expected && typeof expected === "object" && "not" in expected) {
      if (actual === expected.not) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const key = row[field] || "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function flatten(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    output[prefix] = value.join("|");
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }
  output[prefix] = value ?? "";
  return output;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
