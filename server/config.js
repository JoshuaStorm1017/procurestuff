export const APP_CONFIG = {
  "slug": "procurestuff",
  "name": "ProcureStuff",
  "description": "Self-hosted intake-to-procure control with purchase requests, suppliers, approvals, purchase orders, budgets, audit history, and open exports.",
  "port": 4162,
  "dataEnv": "PROCURESTUFF_DATA",
  "dataFile": "procurestuff.json",
  "primaryCollection": "purchaseRequests",
  "primaryLabel": "Purchase Request",
  "displayDateField": "updatedAt",
  "theme": {
    "accent": "#be123c",
    "accentDark": "#9f1239",
    "highlight": "#0f766e",
    "danger": "#dc2626"
  },
  "workspaceFields": [
    { "name": "organizationName", "label": "Organization", "type": "text", "required": true },
    { "name": "procurementPolicy", "label": "Procurement policy", "type": "textarea", "required": true },
    { "name": "approvalCadence", "label": "Approval cadence", "type": "text", "required": true },
    { "name": "spendCategories", "label": "Spend categories", "type": "tags", "required": true },
    { "name": "financeReviewers", "label": "Finance reviewers", "type": "tags", "required": true }
  ],
  "collections": [
    {
      "key": "purchaseRequests",
      "label": "Purchase Requests",
      "navLabel": "Requests",
      "singular": "Purchase Request",
      "prefix": "prq",
      "description": "Intake records for software, services, hardware, budget, supplier, amount, justification, approval, and fulfillment state.",
      "displayField": "title",
      "defaultSort": "neededBy:asc",
      "filters": ["status", "department", "category"],
      "fields": [
        { "name": "title", "label": "Request", "type": "text", "required": true },
        { "name": "requester", "label": "Requester", "type": "text", "required": true },
        { "name": "department", "label": "Department", "type": "select", "options": ["Engineering", "Finance", "Sales", "Marketing", "Operations", "People"], "required": true },
        { "name": "category", "label": "Category", "type": "select", "options": ["Software", "Services", "Hardware", "Travel", "Facilities", "Training"], "required": true },
        { "name": "status", "label": "Status", "type": "select", "options": ["Draft", "Submitted", "Approved", "Ordered", "Received", "Closed", "Rejected"], "required": true },
        { "name": "supplierId", "label": "Supplier", "type": "relation", "collection": "suppliers", "required": true },
        { "name": "budgetId", "label": "Budget", "type": "relation", "collection": "budgets", "required": true },
        { "name": "amount", "label": "Amount", "type": "number", "required": true },
        { "name": "neededBy", "label": "Needed by", "type": "date", "required": true },
        { "name": "justification", "label": "Justification", "type": "textarea", "required": true },
        { "name": "tags", "label": "Tags", "type": "tags" }
      ]
    },
    {
      "key": "suppliers",
      "label": "Suppliers",
      "navLabel": "Suppliers",
      "singular": "Supplier",
      "prefix": "sup",
      "description": "Supplier directory with owner, category, lifecycle status, risk, renewal date, web reference, and notes.",
      "displayField": "title",
      "defaultSort": "title:asc",
      "filters": ["status", "category", "risk"],
      "fields": [
        { "name": "title", "label": "Supplier", "type": "text", "required": true },
        { "name": "category", "label": "Category", "type": "select", "options": ["Software", "Services", "Hardware", "Facilities", "Training"], "required": true },
        { "name": "owner", "label": "Owner", "type": "text", "required": true },
        { "name": "status", "label": "Status", "type": "select", "options": ["Approved", "Pending review", "Conditional", "Blocked", "Archived"], "required": true },
        { "name": "risk", "label": "Risk", "type": "select", "options": ["Low", "Medium", "High", "Critical"], "required": true },
        { "name": "renewalDate", "label": "Renewal date", "type": "date", "required": true },
        { "name": "website", "label": "Website", "type": "url" },
        { "name": "notes", "label": "Notes", "type": "textarea" }
      ]
    },
    {
      "key": "approvals",
      "label": "Approvals",
      "navLabel": "Approvals",
      "singular": "Approval",
      "prefix": "apr",
      "description": "Approval tasks with request linkage, approver, status, due date, and decision notes.",
      "displayField": "title",
      "defaultSort": "dueDate:asc",
      "filters": ["status", "approver"],
      "fields": [
        { "name": "title", "label": "Approval", "type": "text", "required": true },
        { "name": "requestId", "label": "Request", "type": "relation", "collection": "purchaseRequests", "required": true },
        { "name": "approver", "label": "Approver", "type": "text", "required": true },
        { "name": "status", "label": "Status", "type": "select", "options": ["Pending", "Approved", "Changes requested", "Rejected"], "required": true },
        { "name": "dueDate", "label": "Due date", "type": "date", "required": true },
        { "name": "decisionNotes", "label": "Decision notes", "type": "textarea" }
      ]
    },
    {
      "key": "purchaseOrders",
      "label": "Purchase Orders",
      "navLabel": "Orders",
      "singular": "Purchase Order",
      "prefix": "po",
      "description": "Purchase orders tied to requests, suppliers, PO numbers, totals, expected dates, and receipt state.",
      "displayField": "title",
      "defaultSort": "expectedDate:asc",
      "filters": ["status", "poNumber"],
      "fields": [
        { "name": "title", "label": "Order", "type": "text", "required": true },
        { "name": "requestId", "label": "Request", "type": "relation", "collection": "purchaseRequests", "required": true },
        { "name": "supplierId", "label": "Supplier", "type": "relation", "collection": "suppliers", "required": true },
        { "name": "poNumber", "label": "PO number", "type": "text", "required": true },
        { "name": "status", "label": "Status", "type": "select", "options": ["Draft", "Sent", "Partially received", "Received", "Closed"], "required": true },
        { "name": "total", "label": "Total", "type": "number", "required": true },
        { "name": "expectedDate", "label": "Expected date", "type": "date", "required": true },
        { "name": "deliveryNotes", "label": "Delivery notes", "type": "textarea" }
      ]
    },
    {
      "key": "budgets",
      "label": "Budgets",
      "navLabel": "Budgets",
      "singular": "Budget",
      "prefix": "bdg",
      "description": "Budget lines with owners, fiscal period, approved amount, committed spend, status, and notes.",
      "displayField": "title",
      "defaultSort": "title:asc",
      "filters": ["status", "owner", "fiscalPeriod"],
      "fields": [
        { "name": "title", "label": "Budget", "type": "text", "required": true },
        { "name": "owner", "label": "Owner", "type": "text", "required": true },
        { "name": "fiscalPeriod", "label": "Fiscal period", "type": "text", "required": true },
        { "name": "amount", "label": "Approved amount", "type": "number", "required": true },
        { "name": "committed", "label": "Committed", "type": "number", "required": true },
        { "name": "status", "label": "Status", "type": "select", "options": ["Open", "Watch", "Locked", "Closed"], "required": true },
        { "name": "notes", "label": "Notes", "type": "textarea" }
      ]
    }
  ],
  "metrics": [
    { "key": "requestCount", "label": "Active requests", "type": "count", "collection": "purchaseRequests", "helper": "Open procurement intake records" },
    { "key": "requestedSpend", "label": "Requested spend", "type": "sum", "collection": "purchaseRequests", "field": "amount", "format": "currency", "helper": "Total active request value" },
    { "key": "pendingApprovals", "label": "Pending approvals", "type": "countWhere", "collection": "approvals", "where": { "status": "Pending" }, "helper": "Approval tasks awaiting decision" },
    { "key": "renewalsDue", "label": "Supplier renewals", "type": "dueSoon", "collection": "suppliers", "dateField": "renewalDate", "days": 45, "helper": "Renewals due in 45 days" }
  ],
  "actions": [
    { "key": "advanceRequest", "label": "Advance request", "collection": "purchaseRequests", "type": "nextOption", "field": "status", "activity": "advanced purchase request" },
    { "key": "approveTask", "label": "Approve task", "collection": "approvals", "type": "set", "field": "status", "value": "Approved", "activity": "approved procurement task" },
    { "key": "receiveOrder", "label": "Mark received", "collection": "purchaseOrders", "type": "set", "field": "status", "value": "Received", "activity": "marked purchase order received" }
  ],
  "seeds": {
    "workspace": {
      "id": "workspace_procurestuff",
      "organizationName": "Northstar Procurement Office",
      "procurementPolicy": "Every purchase request must connect to a supplier, budget, approval task, purchase order when applicable, and exportable activity record before closure.",
      "approvalCadence": "Daily finance review for submitted requests, weekly supplier risk review",
      "spendCategories": ["Software", "Services", "Hardware", "Training"],
      "financeReviewers": ["Jordan Kim", "Avery Brooks", "Taylor Singh"],
      "updatedAt": "2026-06-14T07:10:00.000Z"
    },
    "session": { "userId": "usr_local", "userName": "Local Procurement Admin", "role": "admin" },
    "suppliers": [
      { "id": "sup_dataplane", "title": "Dataplane Labs", "category": "Software", "owner": "Jordan Kim", "status": "Approved", "risk": "Medium", "renewalDate": "2026-07-18", "website": "https://dataplane.example.local", "notes": "Analytics platform renewal requires usage evidence.", "archivedAt": null, "createdAt": "2026-06-01T13:00:00.000Z", "updatedAt": "2026-06-12T13:00:00.000Z" },
      { "id": "sup_northstar_events", "title": "Northstar Events Group", "category": "Services", "owner": "Avery Brooks", "status": "Pending review", "risk": "High", "renewalDate": "2026-07-05", "website": "https://events.example.local", "notes": "Security review needed before new statement of work.", "archivedAt": null, "createdAt": "2026-06-02T13:00:00.000Z", "updatedAt": "2026-06-12T13:30:00.000Z" },
      { "id": "sup_hardware_hub", "title": "Hardware Hub", "category": "Hardware", "owner": "Taylor Singh", "status": "Approved", "risk": "Low", "renewalDate": "2026-08-20", "website": "https://hardware.example.local", "notes": "Standard laptop and display supplier.", "archivedAt": null, "createdAt": "2026-06-03T13:00:00.000Z", "updatedAt": "2026-06-12T14:00:00.000Z" }
    ],
    "budgets": [
      { "id": "bdg_eng_tools", "title": "Engineering tools FY26", "owner": "Jordan Kim", "fiscalPeriod": "FY26", "amount": 240000, "committed": 171000, "status": "Watch", "notes": "Usage review required before additional software spend.", "archivedAt": null, "createdAt": "2026-06-01T14:00:00.000Z", "updatedAt": "2026-06-12T14:00:00.000Z" },
      { "id": "bdg_marketing_events", "title": "Marketing events FY26", "owner": "Avery Brooks", "fiscalPeriod": "FY26", "amount": 180000, "committed": 92000, "status": "Open", "notes": "Events spend approved through Q3.", "archivedAt": null, "createdAt": "2026-06-02T14:00:00.000Z", "updatedAt": "2026-06-12T14:30:00.000Z" },
      { "id": "bdg_people_hardware", "title": "People hardware refresh", "owner": "Taylor Singh", "fiscalPeriod": "FY26", "amount": 95000, "committed": 48000, "status": "Open", "notes": "New hire hardware pool.", "archivedAt": null, "createdAt": "2026-06-03T14:00:00.000Z", "updatedAt": "2026-06-12T15:00:00.000Z" }
    ],
    "purchaseRequests": [
      { "id": "prq_data_contract", "title": "Renew analytics platform seats", "requester": "Morgan Hale", "department": "Engineering", "category": "Software", "status": "Submitted", "supplierId": "sup_dataplane", "budgetId": "bdg_eng_tools", "amount": 54000, "neededBy": "2026-06-24", "justification": "Renew analytics platform seats used by data engineering and product operations.", "tags": ["renewal", "usage-review"], "archivedAt": null, "createdAt": "2026-06-11T10:00:00.000Z", "updatedAt": "2026-06-13T10:00:00.000Z" },
      { "id": "prq_field_event", "title": "Approve customer workshop event", "requester": "Riley Stone", "department": "Marketing", "category": "Services", "status": "Approved", "supplierId": "sup_northstar_events", "budgetId": "bdg_marketing_events", "amount": 32000, "neededBy": "2026-06-28", "justification": "Regional customer workshop requires venue and production support.", "tags": ["event", "supplier-review"], "archivedAt": null, "createdAt": "2026-06-10T10:00:00.000Z", "updatedAt": "2026-06-13T10:30:00.000Z" },
      { "id": "prq_new_hires", "title": "New hire hardware bundle", "requester": "Casey Lin", "department": "People", "category": "Hardware", "status": "Ordered", "supplierId": "sup_hardware_hub", "budgetId": "bdg_people_hardware", "amount": 18750, "neededBy": "2026-06-21", "justification": "Laptop and display bundles for July onboarding cohort.", "tags": ["onboarding", "hardware"], "archivedAt": null, "createdAt": "2026-06-09T10:00:00.000Z", "updatedAt": "2026-06-13T11:00:00.000Z" }
    ],
    "approvals": [
      { "id": "apr_data_finance", "title": "Finance approval for analytics renewal", "requestId": "prq_data_contract", "approver": "Jordan Kim", "status": "Pending", "dueDate": "2026-06-18", "decisionNotes": "Waiting for seat utilization export.", "archivedAt": null, "createdAt": "2026-06-12T09:00:00.000Z", "updatedAt": "2026-06-13T09:00:00.000Z" },
      { "id": "apr_event_security", "title": "Security review for event supplier", "requestId": "prq_field_event", "approver": "Avery Brooks", "status": "Changes requested", "dueDate": "2026-06-19", "decisionNotes": "Supplier needs updated insurance document.", "archivedAt": null, "createdAt": "2026-06-12T09:30:00.000Z", "updatedAt": "2026-06-13T09:30:00.000Z" },
      { "id": "apr_hardware_finance", "title": "Hardware refresh approval", "requestId": "prq_new_hires", "approver": "Taylor Singh", "status": "Approved", "dueDate": "2026-06-14", "decisionNotes": "Approved against People hardware refresh budget.", "archivedAt": null, "createdAt": "2026-06-12T10:00:00.000Z", "updatedAt": "2026-06-13T10:00:00.000Z" }
    ],
    "purchaseOrders": [
      { "id": "po_data_renewal", "title": "Analytics platform renewal PO", "requestId": "prq_data_contract", "supplierId": "sup_dataplane", "poNumber": "PO-2026-1042", "status": "Draft", "total": 54000, "expectedDate": "2026-06-25", "deliveryNotes": "Issue after finance approval.", "archivedAt": null, "createdAt": "2026-06-12T11:00:00.000Z", "updatedAt": "2026-06-13T11:00:00.000Z" },
      { "id": "po_event_workshop", "title": "Customer workshop services PO", "requestId": "prq_field_event", "supplierId": "sup_northstar_events", "poNumber": "PO-2026-1037", "status": "Sent", "total": 32000, "expectedDate": "2026-06-28", "deliveryNotes": "Venue hold confirmed pending final insurance update.", "archivedAt": null, "createdAt": "2026-06-11T11:00:00.000Z", "updatedAt": "2026-06-13T11:30:00.000Z" },
      { "id": "po_hardware_bundle", "title": "July onboarding hardware PO", "requestId": "prq_new_hires", "supplierId": "sup_hardware_hub", "poNumber": "PO-2026-1029", "status": "Partially received", "total": 18750, "expectedDate": "2026-06-21", "deliveryNotes": "Ten of fifteen bundles received.", "archivedAt": null, "createdAt": "2026-06-10T11:00:00.000Z", "updatedAt": "2026-06-13T12:00:00.000Z" }
    ],
    "activity": [
      { "id": "act_procure_1", "actor": "Local Procurement Admin", "action": "advanced purchase request", "entityType": "purchaseRequests", "entityId": "prq_new_hires", "metadata": { "Request": "New hire hardware bundle" }, "createdAt": "2026-06-13T11:00:00.000Z" },
      { "id": "act_procure_2", "actor": "Local Procurement Admin", "action": "approved procurement task", "entityType": "approvals", "entityId": "apr_hardware_finance", "metadata": { "Approval": "Hardware refresh approval" }, "createdAt": "2026-06-13T10:00:00.000Z" }
    ]
  }
};
