# UX Notes — RBAC + Multi-Tenant Agent Architecture

**Parent Issue:** TarcosS/agent-architecture-management#25  
**Gate:** A (Product Ready)  
**Owner:** designer  
**Dependencies:** US-001 (RBAC role taxonomy)

---

## 1. Scope & Non-Goals

### In Scope (Gate A)
- User flows (happy path + key error states)
- Information architecture for RBAC management and audit log surfaces
- Screen list mapped to user stories
- UX constraints (validation rules, empty states, error states, permission-denied states)
- PII-masking indicators

### Non-Goals
- **Wireframes** — Deferred to Gate B (implementation planning)
- **Production-ready mockups** — Deferred to post-MVP-1
- **Visual design system** — Out of scope for MVP-1
- **Accessibility audit** — Deferred to Gate C (QA readiness)
- **Mobile-specific flows** — Desktop-first; mobile-responsive deferred to post-MVP-1

---

## 2. RBAC Management UI

### 2.1 Information Architecture

| Screen ID | Screen Name | Parent | Mapped To | Description |
|---|---|---|---|---|
| **S-001** | Tenant Selector | Global nav | US-001 | Dropdown/modal to switch active tenant context |
| **S-002** | Role Management Dashboard | `/admin/roles` | US-002 | List of roles within active tenant; CRUD actions |
| **S-003** | Role Assignment View | `/admin/roles/assign` | US-003 | Assign roles to users/agents within tenant |
| **S-004** | Permission Denied Page | `/403` | US-002, US-003 | Shown when user lacks permissions for requested action |
| **S-005** | User-Role List | `/admin/users` | US-003 | View users and their assigned roles within tenant |

### 2.2 User Flow: Role Assignment (Happy Path)

**Trigger:** Admin user wants to assign a role to a new team member  
**Preconditions:** User has `tenant.admin` role in active tenant  

| Step | User Action | System Response |
|---|---|---|
| 1 | Navigate to `/admin/users` | Display user list for active tenant (S-005) |
| 2 | Click "Assign Role" button | Open role assignment modal/form (S-003) |
| 3 | Select user from dropdown | Populate user field; show current roles |
| 4 | Select role from available roles list | Highlight selected role; show role description |
| 5 | Click "Assign" | Validate permissions; POST to `/api/roles/assign` |
| 6 | System confirms assignment | Show success toast; refresh user-role list (S-005) |

**Exit Condition:** User sees updated role assignment in list

### 2.3 User Flow: Role Assignment (Error State — Permission Denied)

**Trigger:** User with insufficient permissions attempts to assign a role  
**Preconditions:** User does NOT have `tenant.admin` role  

| Step | User Action | System Response |
|---|---|---|
| 1 | Navigate to `/admin/users` | Display user list (read-only view) |
| 2 | Click "Assign Role" button (if visible) | Return 403 from API |
| 3 | System shows error | Display Permission Denied Page (S-004) with:<br>- "You do not have permission to assign roles"<br>- "Contact your tenant admin to request access"<br>- Link to return to safe page |

**Exit Condition:** User understands why action failed and how to resolve

### 2.4 Tenant-Switching IA

**Pattern:** Context-aware navigation with tenant indicator

| Element | Behavior | Notes |
|---|---|---|
| **Tenant Selector (S-001)** | Always visible in global nav bar | Shows active tenant name + icon |
| **Dropdown Trigger** | Click tenant name → open tenant list | Scrollable if >10 tenants |
| **Tenant List** | Show all tenants user has access to | Group by role (e.g., Admin, Member, View-Only) |
| **Switch Action** | Click tenant → reload app with new tenant context | Preserve current route if permissions allow; else redirect to tenant home |
| **No-Tenant State** | User has no tenant access | Show "No Tenants Available" + "Request Access" CTA |

### 2.5 UX Constraints — RBAC Management

| Constraint ID | Rule | Rationale |
|---|---|---|
| **C-001** | Role names must be 3-50 characters | Prevent overly short/long names |
| **C-002** | Cannot assign role user already has | Prevent duplicate assignments |
| **C-003** | Cannot delete role if assigned to ≥1 user/agent | Prevent orphaned permissions |
| **C-004** | Tenant selector must show current tenant at all times | User must always know active context |
| **C-005** | Permission-denied errors must be specific | E.g., "You need `tenant.admin` to perform this action" |

---

## 3. Observability / Audit Log Dashboard

### 3.1 Information Architecture

| Screen ID | Screen Name | Parent | Mapped To | Description |
|---|---|---|
| **S-101** | Audit Log Dashboard | `/audit` | US-004 | Main audit log view with filters and search |
| **S-102** | Audit Log Detail | `/audit/:id` | US-004 | Expanded view of single audit event |
| **S-103** | PII-Masked Field Indicator | (component) | US-005 | Visual indicator (e.g., icon + tooltip) for masked fields |
| **S-104** | Filter Panel | (sidebar) | US-004 | Faceted filters (user, action, date range, status) |
| **S-105** | Empty State | (component) | US-004 | Shown when no logs match current filters |

### 3.2 User Flow: Audit Log Search (Happy Path)

**Trigger:** Admin needs to find all role-assignment actions in last 7 days  
**Preconditions:** User has `audit.read` permission  

| Step | User Action | System Response |
|---|---|---|
| 1 | Navigate to `/audit` | Display Audit Log Dashboard (S-101) with default view (last 24h) |
| 2 | Open Filter Panel (S-104) | Expand sidebar with filter options |
| 3 | Select "Action = Role Assigned" | Apply filter; update log list |
| 4 | Select "Date Range = Last 7 Days" | Apply filter; update log list |
| 5 | Review results | Show filtered logs (10-50 per page); highlight PII-masked fields (S-103) |
| 6 | Click event to view details | Navigate to Audit Log Detail (S-102) |

**Exit Condition:** User views detailed event information with full context

### 3.3 User Flow: Audit Log Search (Error State — No Results)

**Trigger:** User searches for events that don't exist  
**Preconditions:** User has `audit.read` permission  

| Step | User Action | System Response |
|---|---|---|
| 1 | Navigate to `/audit` | Display Audit Log Dashboard (S-101) |
| 2 | Enter search query: "nonexistent_user" | Submit search |
| 3 | System finds no matches | Display Empty State (S-105):<br>- "No audit logs found"<br>- "Try adjusting your filters or search terms"<br>- "Clear Filters" button |
| 4 | Click "Clear Filters" | Reset to default view (last 24h logs) |

**Exit Condition:** User understands no results were found and can adjust search

### 3.4 PII-Masking Indicators

**Requirement:** Users must be able to identify which fields are masked due to PII policies

| Field Type | Masking Pattern | Visual Indicator |
|---|---|---|
| **Email** | `j***@example.com` | 🔒 icon + tooltip "Partially masked for privacy" |
| **Username** | `use***` | 🔒 icon + tooltip "Partially masked for privacy" |
| **IP Address** | `192.168.***.***` | 🔒 icon + tooltip "Partially masked for privacy" |
| **Full Name** | `John D***` | 🔒 icon + tooltip "Partially masked for privacy" |
| **No Masking** | (full value) | No icon |

**Tooltip Behavior:**  
- Hover over 🔒 icon → "This field is partially masked to protect personally identifiable information (PII)."
- If user has `pii.unmask` permission → Add "Request full access" link in tooltip

### 3.5 UX Constraints — Audit Log Dashboard

| Constraint ID | Rule | Rationale |
|---|---|---|
| **C-101** | Audit logs are read-only | Prevent tampering with audit trail |
| **C-102** | Date range filter max = 90 days | Prevent performance issues from large queries |
| **C-103** | PII-masked fields always show 🔒 icon | User must be aware of masked data |
| **C-104** | Empty state must suggest actionable next steps | Help user recover from "no results" |
| **C-105** | Pagination required if >50 results | Prevent overwhelming user with massive lists |

---

## 4. Full User Journeys

### 4.1 Journey: Admin Assigns Role to New Agent (Happy Path)

**Persona:** Sarah, Tenant Admin  
**Goal:** Assign "agent.executor" role to new automation agent  
**Context:** Sarah's team deployed a new agent and needs it to execute workflows  

| Step | Action | Screen | System Response |
|---|---|---|---|
| 1 | Sarah logs into platform | Login | Redirect to default tenant dashboard |
| 2 | Navigate to Admin > Users | S-005 | Show user-role list (includes agents) |
| 3 | Click "Assign Role" | S-003 | Open role assignment form |
| 4 | Select agent "workflow-bot" from dropdown | S-003 | Populate agent field; show current roles (none) |
| 5 | Select "agent.executor" role | S-003 | Highlight role; show description |
| 6 | Click "Assign" | S-003 | Validate; POST to API; show success toast |
| 7 | Verify assignment in list | S-005 | "workflow-bot" now shows "agent.executor" |

**Outcome:** ✅ Agent can now execute workflows  
**Edge Cases Handled:** None in happy path  

### 4.2 Journey: Admin Assigns Role to New Agent (Error — Permission Denied)

**Persona:** Bob, Tenant Member (not admin)  
**Goal:** Assign role to agent (but lacks permission)  
**Context:** Bob believes he can assign roles but his account is "member" tier  

| Step | Action | Screen | System Response |
|---|---|---|---|
| 1 | Bob logs into platform | Login | Redirect to default tenant dashboard |
| 2 | Navigate to Admin > Users | S-005 | Show user-role list (read-only; no "Assign Role" button) |
| 3 | Bob manually navigates to `/admin/roles/assign` | S-003 | API returns 403 Forbidden |
| 4 | System redirects to Permission Denied page | S-004 | Show:<br>- "You need `tenant.admin` role"<br>- "Contact: sarah@example.com (Tenant Admin)"<br>- "Return to Dashboard" button |
| 5 | Bob clicks "Return to Dashboard" | Dashboard | Redirect to safe landing page |

**Outcome:** ❌ Bob cannot assign role; understands why and who to contact  
**Edge Cases Handled:** User manually types restricted URL  

### 4.3 Journey: Auditor Investigates Suspicious Role Change (Happy Path)

**Persona:** Alice, Security Auditor  
**Goal:** Find who changed a critical agent's role last week  
**Context:** Monitoring detected unexpected behavior from "data-processor" agent  

| Step | Action | Screen | System Response |
|---|---|---|---|
| 1 | Alice navigates to Audit > Logs | S-101 | Show default view (last 24h logs) |
| 2 | Open Filter Panel | S-104 | Expand filters sidebar |
| 3 | Set Date Range = "Last 7 Days" | S-104 | Apply filter; refresh log list |
| 4 | Set Action = "Role Modified" | S-104 | Apply filter; refresh log list |
| 5 | Enter Search = "data-processor" | S-104 | Filter logs mentioning "data-processor" |
| 6 | Review results (3 events found) | S-101 | Show 3 role-change events; PII fields masked (🔒) |
| 7 | Click event "2025-01-15 14:32 UTC" | S-102 | Show details:<br>- Actor: `adm***@example.com` (masked)<br>- Action: "Role Modified"<br>- Target: "data-processor"<br>- Old Role: "agent.read-only"<br>- New Role: "agent.admin" |
| 8 | Alice notes suspicious escalation | S-102 | (Alice escalates to security team) |

**Outcome:** ✅ Alice identifies suspicious role escalation  
**Edge Cases Handled:** None in happy path  

### 4.4 Journey: Auditor Investigates Suspicious Role Change (Error — No Results)

**Persona:** Alice, Security Auditor  
**Goal:** Investigate agent that may not exist  
**Context:** Typo in agent name during search  

| Step | Action | Screen | System Response |
|---|---|---|---|
| 1 | Alice navigates to Audit > Logs | S-101 | Show default view |
| 2 | Enter Search = "data-processer" (typo) | S-104 | Submit search |
| 3 | System finds no matches | S-105 | Show Empty State:<br>- "No audit logs found"<br>- "Check spelling or adjust filters"<br>- "Clear Filters" button |
| 4 | Alice clicks "Clear Filters" | S-101 | Reset to default view |
| 5 | Alice corrects search = "data-processor" | S-104 | Submit search; show results |

**Outcome:** ✅ Alice recovers from typo and finds correct results  
**Edge Cases Handled:** User typo/misspelling in search  

---

## 5. Screen List — Summary Table

| Screen ID | Name | Route | Mapped To | Priority | Notes |
|---|---|---|---|---|---|
| S-001 | Tenant Selector | (global nav) | US-001 | P0 | Always visible; context indicator |
| S-002 | Role Management Dashboard | `/admin/roles` | US-002 | P0 | CRUD for roles |
| S-003 | Role Assignment View | `/admin/roles/assign` | US-003 | P0 | Assign roles to users/agents |
| S-004 | Permission Denied Page | `/403` | US-002, US-003 | P0 | Error state with actionable guidance |
| S-005 | User-Role List | `/admin/users` | US-003 | P0 | View users + their roles |
| S-101 | Audit Log Dashboard | `/audit` | US-004 | P0 | Main audit view with filters |
| S-102 | Audit Log Detail | `/audit/:id` | US-004 | P1 | Expanded single event view |
| S-103 | PII-Masked Field Indicator | (component) | US-005 | P0 | Visual indicator for masked fields |
| S-104 | Filter Panel | (sidebar) | US-004 | P0 | Faceted filters for audit logs |
| S-105 | Empty State | (component) | US-004 | P1 | No results state with recovery |

**Priority Key:**  
- **P0:** Gate A / MVP-1 critical  
- **P1:** Gate B / Post-MVP-1  

---

## 6. Key Edge Cases & Error States

### 6.1 RBAC Management

| Edge Case | Expected Behavior |
|---|---|
| User tries to assign role they don't have permission to assign | Show permission-denied error (S-004) with specific missing permission |
| User tries to delete role currently assigned to active users | Block deletion; show error: "Cannot delete role assigned to N users" |
| User switches tenant mid-action (e.g., during role assignment) | Cancel current action; reload page in new tenant context |
| User has no tenants | Show "No Tenants Available" empty state with "Request Access" CTA |
| Tenant selector fails to load | Show error: "Unable to load tenants. Refresh to try again." |

### 6.2 Audit Log Dashboard

| Edge Case | Expected Behavior |
|---|---|
| User searches for events outside max date range (>90 days) | Show validation error: "Date range cannot exceed 90 days" |
| Audit log API times out | Show error: "Unable to load logs. Try narrowing your search." |
| User lacks `audit.read` permission | Redirect to Permission Denied page (S-004) |
| Pagination exceeds available results | Show last page; disable "Next" button |
| PII-masking service unavailable | Show unmasked data with warning banner: "PII masking temporarily unavailable" |

---

## 7. Validation Rules

### 7.1 Role Assignment Form

| Field | Validation | Error Message |
|---|---|---|
| User/Agent Dropdown | Required; must be valid user/agent ID | "Please select a user or agent" |
| Role Dropdown | Required; must be valid role ID | "Please select a role" |
| Duplicate Check | Cannot assign role user already has | "User already has this role" |

### 7.2 Audit Log Filters

| Field | Validation | Error Message |
|---|---|---|
| Date Range | Start date ≤ End date | "Start date must be before end date" |
| Date Range | Max 90 days | "Date range cannot exceed 90 days" |
| Search Query | Min 2 characters | "Enter at least 2 characters to search" |

---

## 8. Assumptions

- **A1:** Users understand the concept of "tenant" without extensive onboarding (can be clarified in first-run tooltip)
- **A2:** Role names are human-readable and self-explanatory (e.g., "Admin", "Executor", "Read-Only")
- **A3:** PII-masking logic is handled server-side; UI only displays masked data
- **A4:** Audit log search supports basic text matching (not advanced regex/query syntax at Gate A)
- **A5:** Users access the system via desktop browsers (mobile-responsive deferred)

---

## 9. Open Questions

- **Q1:** Should tenant selector support search/filter for users with >20 tenants? (Owner: designer → swe)
- **Q2:** What is the default sort order for audit logs? (Most recent first assumed; confirm with pm)
- **Q3:** Do we need role-hierarchy visualization (e.g., "Admin > Member > View-Only")? (Owner: designer → pm)
- **Q4:** Should permission-denied page include a "Request Access" form or just contact info? (Owner: designer → pm)

---

## 10. Next Steps (Gate A → Gate B)

1. **SWE (Gate B):** Convert screens S-001..S-005, S-101..S-105 into component/route breakdown
2. **QA (Gate C):** Map user journeys (§4) to test case IDs in test strategy
3. **Designer (Gate B):** Create low-fidelity wireframes for S-001, S-003, S-101 (optional; only if requested)
4. **PM:** Confirm priority of S-102 (P1) vs. S-101 (P0) for MVP-1 scope

---

**Document Status:** ✅ Gate A Ready  
**Last Updated:** 2025-01-16  
**Owner:** designer  
**Next Review:** Gate B (SWE tech plan review)
