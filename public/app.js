const app = document.querySelector("#app");

const ui = {
  data: null,
  view: "dashboard",
  selected: null,
  search: "",
  filterField: "",
  filterValue: "",
  sort: "",
  busy: false
};

loadState();

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const value = target.dataset.value || "";
  if (action === "nav") {
    ui.view = value;
    ui.selected = null;
    resetControls();
    render();
  }
  if (action === "select-row") {
    ui.selected = { collection: target.dataset.collection, id: target.dataset.id };
    render();
  }
  if (action === "new") openEditor(value);
  if (action === "edit") openEditor(target.dataset.collection, target.dataset.id);
  if (action === "close-modal") closeModal();
  if (action === "archive") await mutate(`/api/${target.dataset.collection}/${target.dataset.id}/archive`, { method: "POST" }, "Record archived.");
  if (action === "restore") await mutate(`/api/${target.dataset.collection}/${target.dataset.id}/restore`, { method: "POST" }, "Record restored.");
  if (action === "workflow") await mutate(`/api/actions/${value}`, { method: "POST", body: { id: target.dataset.id } }, "Workflow action saved.");
  if (action === "export-all") window.location.href = "/api/export/all.json";
  if (action === "export-json") window.location.href = `/api/export/${value}.json`;
  if (action === "export-csv") window.location.href = `/api/export/${value}.csv`;
  if (action === "import") openImport();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-search]")) {
    ui.search = target.value;
    renderCollection(ui.view);
  }
  if (target.matches("[data-filter-field]")) {
    ui.filterField = target.value;
    ui.filterValue = "";
    renderCollection(ui.view);
  }
  if (target.matches("[data-filter-value]")) {
    ui.filterValue = target.value;
    renderCollection(ui.view);
  }
  if (target.matches("[data-sort]")) {
    ui.sort = target.value;
    renderCollection(ui.view);
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.matches("[data-entity-form]")) await submitEntityForm(form);
  if (form.matches("[data-settings-form]")) await submitSettingsForm(form);
  if (form.matches("[data-import-form]")) await submitImportForm(form);
});

async function loadState() {
  setBusy(true);
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("State request failed.");
    ui.data = await response.json();
    document.title = ui.data.config.name;
    render();
  } catch (error) {
    app.innerHTML = `<main class="boot-panel"><h1>Local server unavailable</h1><p>${escapeHtml(error.message)}</p></main>`;
  } finally {
    setBusy(false);
  }
}

async function mutate(path, options, successMessage) {
  setBusy(true);
  try {
    const response = await fetch(path, {
      method: options.method || "POST",
      headers: { "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json();
    if (!response.ok) throw new Error((payload.errors || ["Request failed."]).join(" "));
    ui.data = payload;
    showToast(successMessage);
    render();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(false);
  }
}

function render() {
  if (!ui.data) return;
  const config = ui.data.config;
  applyTheme(config.theme);
  app.className = "app-shell";
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">${icon("layers")}</div>
        <div>
          <h1>${escapeHtml(config.name)}</h1>
          <p>${escapeHtml(config.description)}</p>
        </div>
      </div>
      <nav class="nav" aria-label="Product navigation">
        ${navButton("dashboard", "Dashboard", "dashboard")}
        ${config.collections.map((collection) => navButton(collection.key, collection.navLabel || collection.label, "table")).join("")}
        ${navButton("settings", "Settings", "settings")}
      </nav>
      <div class="sidebar-foot">
        <button class="sidebar-action" data-action="export-all">${icon("download")} Export workspace</button>
        <button class="sidebar-action" data-action="import">${icon("upload")} Import workspace</button>
      </div>
    </aside>
    <main class="main">
      <div id="view-root"></div>
    </main>
  `;
  if (ui.view === "dashboard") renderDashboard();
  else if (ui.view === "settings") renderSettings();
  else renderCollection(ui.view);
}

function renderDashboard() {
  const root = document.querySelector("#view-root");
  const config = ui.data.config;
  const metrics = config.metrics.map((metric) => {
    const value = ui.data.analytics.metrics[metric.key] ?? 0;
    return `<article class="metric"><strong>${formatMetric(value, metric)}</strong><span>${escapeHtml(metric.label)}</span><span>${escapeHtml(metric.helper || "")}</span></article>`;
  }).join("");
  const primary = collectionConfig(config.primaryCollection);
  const primaryRows = activeRows(primary.key).slice(0, 5);
  root.innerHTML = `
    <section class="topbar">
      <div>
        <h2>${escapeHtml(config.name)} control room</h2>
        <p>${escapeHtml(config.description)}</p>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="new" data-value="${primary.key}">${icon("plus")} New ${escapeHtml(primary.singular)}</button>
        <button class="btn" data-action="export-all">${icon("download")} Export</button>
      </div>
    </section>
    <section class="grid metrics">${metrics}</section>
    <section class="grid dashboard-grid">
      <article class="panel">
        <div class="panel-header">
          <div><h3>${escapeHtml(primary.label)} by status</h3><p>Computed from active local records.</p></div>
        </div>
        <div class="chart">${renderBreakdown(ui.data.analytics.primaryBreakdown)}</div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div><h3>Priority queue</h3><p>Newest active ${escapeHtml(primary.label.toLowerCase())} records.</p></div>
        </div>
        <ul class="queue-list">
          ${primaryRows.map((row) => `<li><strong>${escapeHtml(row[primary.displayField])}</strong><span class="small">${escapeHtml(summaryLine(primary, row))}</span></li>`).join("") || `<li class="empty">No active records.</li>`}
        </ul>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div><h3>Recent activity</h3><p>Audit trail from local workflow changes.</p></div>
        </div>
        <ul class="activity-list">${renderActivity()}</ul>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div><h3>Open data exits</h3><p>Every core entity has JSON and CSV exports.</p></div>
        </div>
        <ul class="queue-list">
          ${config.collections.map((collection) => `<li><strong>${escapeHtml(collection.label)}</strong><div class="actions"><button class="btn" data-action="export-json" data-value="${collection.key}">${icon("download")} JSON</button><button class="btn" data-action="export-csv" data-value="${collection.key}">${icon("download")} CSV</button></div></li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function renderCollection(collectionKey) {
  const root = document.querySelector("#view-root");
  if (!root) return;
  const collection = collectionConfig(collectionKey);
  if (!collection) {
    ui.view = "dashboard";
    return render();
  }
  const rows = filteredRows(collection);
  if (!ui.sort) ui.sort = collection.defaultSort || `${collection.displayField}:asc`;
  const selected = selectedRow(collection.key);
  root.innerHTML = `
    <section class="topbar">
      <div>
        <h2>${escapeHtml(collection.label)}</h2>
        <p>${escapeHtml(collection.description)}</p>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="new" data-value="${collection.key}">${icon("plus")} New ${escapeHtml(collection.singular)}</button>
        <button class="btn" data-action="export-json" data-value="${collection.key}">${icon("download")} JSON</button>
        <button class="btn" data-action="export-csv" data-value="${collection.key}">${icon("download")} CSV</button>
      </div>
    </section>
    <section class="workbench">
      <div>
        ${renderTableTools(collection)}
        <p class="statusline">${rows.length} active records shown. Archived records remain restorable from direct detail links after archive actions.</p>
        <div class="table-wrap">
          <table>
            <thead><tr>${tableFields(collection).map((field) => `<th>${escapeHtml(field.label)}</th>`).join("")}<th>Updated</th></tr></thead>
            <tbody>${rows.map((row) => renderTableRow(collection, row)).join("") || `<tr><td colspan="${tableFields(collection).length + 1}" class="empty">No records match the current filters.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      <aside class="panel inspector">
        ${selected ? renderInspector(collection, selected) : `<h3>${escapeHtml(collection.singular)} detail</h3><p class="small">Select a row to inspect fields, edit, run workflow actions, archive, or restore.</p>`}
      </aside>
    </section>
  `;
}

function renderTableTools(collection) {
  const filterFields = collection.filters.map((name) => collection.fields.find((field) => field.name === name)).filter(Boolean);
  const activeFilter = filterFields.find((field) => field.name === ui.filterField) || filterFields[0];
  if (!ui.filterField && activeFilter) ui.filterField = activeFilter.name;
  const filterOptions = activeFilter ? uniqueValues(collection.key, activeFilter.name) : [];
  const sortFields = tableFields(collection);
  return `
    <div class="table-tools">
      <label class="field"><span>Search</span><input class="input" data-search value="${escapeAttr(ui.search)}"></label>
      <label class="field"><span>Filter field</span><select data-filter-field>${filterFields.map((field) => `<option value="${field.name}" ${field.name === ui.filterField ? "selected" : ""}>${escapeHtml(field.label)}</option>`).join("")}</select></label>
      <label class="field"><span>Filter value</span><select data-filter-value><option value="">All</option>${filterOptions.map((value) => `<option value="${escapeAttr(value)}" ${value === ui.filterValue ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
      <label class="field"><span>Sort</span><select data-sort>${sortFields.map((field) => [`${field.name}:asc`, `${field.name}:desc`].map((value) => `<option value="${value}" ${value === ui.sort ? "selected" : ""}>${escapeHtml(field.label)} ${value.endsWith(":asc") ? "A-Z" : "Z-A"}</option>`).join("")).join("")}</select></label>
      <button class="btn" data-action="new" data-value="${collection.key}">${icon("plus")} Create</button>
    </div>
  `;
}

function renderTableRow(collection, row) {
  const selected = ui.selected?.collection === collection.key && ui.selected?.id === row.id;
  return `
    <tr class="${selected ? "selected" : ""}" data-action="select-row" data-collection="${collection.key}" data-id="${row.id}">
      ${tableFields(collection).map((field) => `<td>${formatField(field, row[field.name])}</td>`).join("")}
      <td><span class="small">${formatDateTime(row.updatedAt)}</span></td>
    </tr>
  `;
}

function renderInspector(collection, row) {
  const actions = ui.data.config.actions.filter((action) => action.collection === collection.key);
  return `
    <h3>${escapeHtml(row[collection.displayField] || collection.singular)}</h3>
    <p class="small">${escapeHtml(summaryLine(collection, row))}</p>
    <div class="actions">
      <button class="btn primary" data-action="edit" data-collection="${collection.key}" data-id="${row.id}">${icon("edit")} Edit</button>
      ${row.archivedAt ? `<button class="btn" data-action="restore" data-collection="${collection.key}" data-id="${row.id}">${icon("refresh")} Restore</button>` : `<button class="btn danger" data-action="archive" data-collection="${collection.key}" data-id="${row.id}">${icon("archive")} Archive</button>`}
    </div>
    <div class="detail-list">
      ${collection.fields.map((field) => `<div class="detail-item"><b>${escapeHtml(field.label)}</b><span>${formatField(field, row[field.name])}</span></div>`).join("")}
      <div class="detail-item"><b>Created</b><span>${formatDateTime(row.createdAt)}</span></div>
      <div class="detail-item"><b>Updated</b><span>${formatDateTime(row.updatedAt)}</span></div>
    </div>
    ${actions.length ? `<div class="actions">${actions.map((action) => `<button class="btn warn" data-action="workflow" data-value="${action.key}" data-id="${row.id}">${icon("check")} ${escapeHtml(action.label)}</button>`).join("")}</div>` : ""}
  `;
}

function renderSettings() {
  const root = document.querySelector("#view-root");
  const config = ui.data.config;
  root.innerHTML = `
    <section class="topbar">
      <div>
        <h2>Workspace settings</h2>
        <p>Local operating policy for ${escapeHtml(config.name)}.</p>
      </div>
      <div class="toolbar">
        <button class="btn" data-action="export-all">${icon("download")} Export workspace</button>
        <button class="btn" data-action="import">${icon("upload")} Import workspace</button>
      </div>
    </section>
    <section class="panel">
      <form data-settings-form class="settings-form">
        <div class="form-grid">
          ${config.workspaceFields.map((field) => renderFieldInput(field, ui.data.workspace[field.name])).join("")}
        </div>
        <div class="actions"><button class="btn primary" type="submit">${icon("save")} Save settings</button></div>
      </form>
    </section>
  `;
}

function openEditor(collectionKey, id = "") {
  const collection = collectionConfig(collectionKey);
  const row = id ? (ui.data[collectionKey] || []).find((item) => item.id === id) : {};
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <article class="modal">
        <header>
          <h3>${id ? "Edit" : "New"} ${escapeHtml(collection.singular)}</h3>
          <button class="btn ghost" data-action="close-modal" type="button">${icon("close")}</button>
        </header>
        <form data-entity-form data-collection="${collection.key}" data-id="${id || ""}">
          <div class="form-grid">
            ${collection.fields.map((field) => renderFieldInput(field, row?.[field.name])).join("")}
          </div>
          <div class="actions">
            <button class="btn primary" type="submit">${icon("save")} Save</button>
            <button class="btn" data-action="close-modal" type="button">Cancel</button>
          </div>
        </form>
      </article>
    </div>
  `);
}

function openImport() {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <article class="modal">
        <header>
          <h3>Import workspace JSON</h3>
          <button class="btn ghost" data-action="close-modal" type="button">${icon("close")}</button>
        </header>
        <form data-import-form>
          <label class="field wide"><span>Workspace JSON</span><textarea class="import-box" name="snapshot"></textarea></label>
          <div class="actions">
            <button class="btn primary" type="submit">${icon("upload")} Import</button>
            <button class="btn" data-action="close-modal" type="button">Cancel</button>
          </div>
        </form>
      </article>
    </div>
  `);
}

async function submitEntityForm(form) {
  const collectionKey = form.dataset.collection;
  const id = form.dataset.id;
  const collection = collectionConfig(collectionKey);
  const body = {};
  for (const field of collection.fields) body[field.name] = readFieldValue(form, field);
  await mutate(id ? `/api/${collectionKey}/${id}` : `/api/${collectionKey}`, { method: id ? "PATCH" : "POST", body }, id ? "Record updated." : "Record created.");
  closeModal();
}

async function submitSettingsForm(form) {
  const body = {};
  for (const field of ui.data.config.workspaceFields) body[field.name] = readFieldValue(form, field);
  await mutate("/api/workspace", { method: "PATCH", body }, "Settings saved.");
}

async function submitImportForm(form) {
  try {
    const snapshot = JSON.parse(form.elements.snapshot.value);
    await mutate("/api/import", { method: "POST", body: snapshot }, "Workspace imported.");
    closeModal();
  } catch {
    showToast("Import JSON could not be parsed.", true);
  }
}

function renderFieldInput(field, value) {
  const name = escapeAttr(field.name);
  const label = `<span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>`;
  const wide = field.type === "textarea" || field.type === "relationMany" || field.type === "tags" ? " wide" : "";
  if (field.type === "textarea") return `<label class="field${wide}">${label}<textarea name="${name}">${escapeHtml(value || "")}</textarea></label>`;
  if (field.type === "select") return `<label class="field${wide}">${label}<select name="${name}">${field.options.map((option) => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  if (field.type === "relation") return `<label class="field${wide}">${label}<select name="${name}"><option value="">None</option>${relationOptions(field, value)}</select></label>`;
  if (field.type === "relationMany") return `<label class="field${wide}">${label}<select name="${name}" multiple size="5">${relationOptions(field, value)}</select></label>`;
  if (field.type === "tags" || field.type === "multiselect") return `<label class="field${wide}">${label}<input name="${name}" value="${escapeAttr(Array.isArray(value) ? value.join(", ") : value || "")}"><span class="small">Comma-separated values.</span></label>`;
  if (field.type === "boolean") return `<label class="field${wide}">${label}<select name="${name}"><option value="true" ${value ? "selected" : ""}>Yes</option><option value="false" ${!value ? "selected" : ""}>No</option></select></label>`;
  const htmlType = field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "number" ? "number" : "text";
  return `<label class="field${wide}">${label}<input type="${htmlType}" name="${name}" value="${escapeAttr(value || "")}"></label>`;
}

function readFieldValue(form, field) {
  const element = form.elements[field.name];
  if (!element) return "";
  if (field.type === "relationMany") return Array.from(element.selectedOptions).map((option) => option.value);
  if (field.type === "tags" || field.type === "multiselect") return element.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (field.type === "number") return Number(element.value);
  if (field.type === "boolean") return element.value === "true";
  return element.value;
}

function relationOptions(field, value) {
  const selected = new Set(Array.isArray(value) ? value : [value]);
  const collection = collectionConfig(field.collection);
  return activeRows(field.collection).map((row) => `<option value="${row.id}" ${selected.has(row.id) ? "selected" : ""}>${escapeHtml(row[collection.displayField] || row.id)}</option>`).join("");
}

function filteredRows(collection) {
  const terms = ui.search.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = activeRows(collection.key).filter((row) => {
    const haystack = JSON.stringify(row).toLowerCase();
    const matchesSearch = terms.every((term) => haystack.includes(term));
    const matchesFilter = !ui.filterField || !ui.filterValue || String(row[ui.filterField] || "").includes(ui.filterValue);
    return matchesSearch && matchesFilter;
  });
  const [field, direction] = (ui.sort || collection.defaultSort || `${collection.displayField}:asc`).split(":");
  return rows.sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? ""), undefined, { numeric: true }) * (direction === "desc" ? -1 : 1));
}

function tableFields(collection) {
  return collection.fields.slice(0, 5);
}

function activeRows(collectionKey) {
  return (ui.data?.[collectionKey] || []).filter((row) => !row.archivedAt);
}

function selectedRow(collectionKey) {
  if (ui.selected?.collection !== collectionKey) return null;
  return (ui.data?.[collectionKey] || []).find((row) => row.id === ui.selected.id) || null;
}

function collectionConfig(collectionKey) {
  return ui.data?.config.collections.find((collection) => collection.key === collectionKey);
}

function uniqueValues(collectionKey, field) {
  const values = new Set();
  for (const row of activeRows(collectionKey)) {
    const value = row[field];
    if (Array.isArray(value)) value.forEach((item) => values.add(item));
    else if (value) values.add(String(value));
  }
  return [...values].sort();
}

function formatField(field, value) {
  if (Array.isArray(value)) return value.length ? `<span class="pill-row">${value.map((item) => `<span class="pill">${escapeHtml(displayRelated(field, item))}</span>`).join("")}</span>` : `<span class="small">None</span>`;
  if (field.type === "relation") return escapeHtml(displayRelated(field, value) || "None");
  if (field.type === "url" && value) return `<a href="${escapeAttr(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`;
  if (field.type === "date" && value) return escapeHtml(new Date(`${value}T00:00:00`).toLocaleDateString());
  if (field.type === "textarea") return escapeHtml(value || "");
  if (field.name.toLowerCase().includes("status") || field.name.toLowerCase().includes("risk") || field.name.toLowerCase().includes("decision")) return `<span class="pill neutral">${escapeHtml(value || "None")}</span>`;
  return escapeHtml(value ?? "");
}

function displayRelated(field, value) {
  if (!value) return "";
  if (field.collection) {
    const collection = collectionConfig(field.collection);
    const row = (ui.data[field.collection] || []).find((item) => item.id === value);
    return row ? row[collection.displayField] || row.id : value;
  }
  return value;
}

function summaryLine(collection, row) {
  return tableFields(collection).slice(1, 4).map((field) => `${field.label}: ${displayPlain(field, row[field.name])}`).join(" · ");
}

function displayPlain(field, value) {
  if (Array.isArray(value)) return value.join(", ") || "None";
  if (field.type === "relation") return displayRelated(field, value) || "None";
  return value || "None";
}

function renderBreakdown(counts) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return entries.map(([label, count]) => `
    <div class="bar-row">
      <strong>${escapeHtml(label)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, (count / max) * 100)}%"></div></div>
      <span>${count}</span>
    </div>
  `).join("") || `<div class="empty">No active records yet.</div>`;
}

function renderActivity() {
  return (ui.data.analytics.activity || []).slice(0, 8).map((item) => `
    <li>
      <strong>${escapeHtml(item.action)}</strong>
      <span class="small">${escapeHtml(item.actor || "Local Admin")} · ${escapeHtml(item.entityType)} · ${formatDateTime(item.createdAt)}</span>
    </li>
  `).join("") || `<li class="empty">No activity recorded.</li>`;
}

function navButton(view, label, iconName) {
  return `<button class="${ui.view === view ? "active" : ""}" data-action="nav" data-value="${view}">${icon(iconName)} ${escapeHtml(label)}</button>`;
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function resetControls() {
  ui.search = "";
  ui.filterField = "";
  ui.filterValue = "";
  ui.sort = "";
}

function setBusy(isBusy) {
  ui.busy = isBusy;
  document.body.style.cursor = isBusy ? "progress" : "";
}

function showToast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const element = document.createElement("div");
  element.className = `toast ${error ? "error" : ""}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 3600);
}

function formatMetric(value, metric) {
  if (metric.format === "currency") return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (metric.format === "percent") return `${value}%`;
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function applyTheme(theme = {}) {
  const root = document.documentElement;
  if (theme.accent) root.style.setProperty("--accent", theme.accent);
  if (theme.highlight) root.style.setProperty("--accent-2", theme.highlight);
  if (theme.danger) root.style.setProperty("--danger", theme.danger);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function icon(name) {
  const paths = {
    layers: "<path d='M12 3 3 7.5l9 4.5 9-4.5L12 3Z'/><path d='m3 12 9 4.5 9-4.5'/><path d='m3 16.5 9 4.5 9-4.5'/>",
    dashboard: "<path d='M4 13h6V4H4v9Z'/><path d='M14 20h6V4h-6v16Z'/><path d='M4 20h6v-3H4v3Z'/>",
    table: "<path d='M4 5h16v14H4V5Z'/><path d='M4 10h16'/><path d='M10 5v14'/>",
    settings: "<path d='M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'/><path d='M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L12.4 3H8.6L8.2 6a7 7 0 0 0-1.8 1l-2.4-1-2 3.4L4 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3h3.8l.4-3a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.6.1-1Z'/>",
    download: "<path d='M12 3v12'/><path d='m7 10 5 5 5-5'/><path d='M5 21h14'/>",
    upload: "<path d='M12 21V9'/><path d='m7 14 5-5 5 5'/><path d='M5 3h14'/>",
    plus: "<path d='M12 5v14'/><path d='M5 12h14'/>",
    edit: "<path d='M4 20h4l11-11-4-4L4 16v4Z'/><path d='m13 7 4 4'/>",
    archive: "<path d='M4 7h16'/><path d='M6 7v13h12V7'/><path d='M9 11h6'/><path d='M5 4h14v3H5V4Z'/>",
    refresh: "<path d='M20 12a8 8 0 0 1-14 5'/><path d='M4 17h6v-6'/><path d='M4 12a8 8 0 0 1 14-5'/><path d='M20 7h-6v6'/>",
    check: "<path d='m5 12 4 4L19 6'/>",
    save: "<path d='M5 4h12l2 2v14H5V4Z'/><path d='M8 4v6h8V4'/><path d='M8 20v-6h8v6'/>",
    close: "<path d='m6 6 12 12'/><path d='m18 6-12 12'/>"
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.table}</svg>`;
}
