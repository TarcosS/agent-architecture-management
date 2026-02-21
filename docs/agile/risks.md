# Risks, Assumptions & Dependency Map

## 1. Assumptions

- **A1: Event Broker Greenfield Deployment**  
  There is no existing event broker infrastructure (Kafka, RabbitMQ, NATS, etc.) deployed. TK-004 must provision a new message bus from scratch, including topic/queue configuration, access controls, and monitoring instrumentation.

- **A2: No Existing Tenant Data or Schema**  
  The database is either empty or contains no tenant-scoped data. RBAC schema (TK-001) and tenant isolation logic (TK-003) can be introduced without requiring complex data backfills or tenant ID migrations on existing records.

- **A3: OAuth/OIDC Provider Availability**  
  An external identity provider (e.g., Auth0, Okta, Azure AD) is available and accessible for integration. The provider supports standard OIDC flows (authorization code + PKCE) and can issue JWT tokens with tenant/role claims.

- **A4: Zero-Downtime Migration Requirement**  
  All database migrations (TK-001, TK-007) must support rolling deployments. Backward-compatible schema changes (additive columns, no breaking renames) are mandatory; migration scripts (TK-011) will use expand-contract pattern.

- **A5: PII Logging Compliance**  
  The organization has a defined PII policy (e.g., GDPR, CCPA) that requires redaction of sensitive fields (email, SSN, payment info) in audit logs. The PII scrubbing implementation (TK-008) will use a field allowlist approach (log only approved fields).

- **A6: Single-Region Deployment for Initial Release**  
  The platform will initially deploy to a single cloud region. Cross-region replication, global routing, and geo-fencing are out of scope for Gate D. Event broker and database are co-located in the same region to minimize latency.

---

## 2. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| **R-001** | **Event broker unavailability or message loss** leading to missing audit events or failed workflows | Medium | High | Deploy broker with persistent storage + replication (min 3 replicas). Implement outbox pattern (TK-005) for at-least-once delivery. Add dead-letter queue + alerting for broker downtime. | devops |
| **R-002** | **RBAC misconfiguration** allowing privilege escalation or unauthorized tenant access | Medium | High | Enforce permission checks at API gateway + service layers (TK-002). Implement automated permission matrix tests in TK-013. Require security review (Gate D) for any role/permission changes. | security |
| **R-003** | **PII leakage in audit logs** exposing sensitive user data in log aggregation systems | Medium | High | Apply PII scrubbing at log write-time (TK-008). Use field allowlist (log only safe fields). Add automated tests scanning logs for known PII patterns (email regex, phone numbers). | security |
| **R-004** | **Database migration failures** causing downtime or data corruption during zero-downtime deployments | Low | High | Use expand-contract migration pattern (TK-011). Test migrations on production-like datasets. Require rollback script for every forward migration. Implement schema versioning + compatibility checks. | devops |
| **R-005** | **Third-party auth provider (OIDC) outage** blocking all user logins | Low | High | Implement token caching with refresh logic (TK-010). Add circuit breaker for auth provider calls. Define degraded-mode behavior (e.g., reject new logins but allow cached sessions). Monitor provider SLA + maintain fallback runbook. | swe |
| **R-006** | **Tenant data cross-contamination** due to missing or incorrect tenant isolation filters in queries | Medium | High | Enforce tenant_id filter at ORM/query builder level (TK-003). Add row-level security (RLS) policies in DB if supported. Implement automated cross-tenant data leak tests in TK-013. Require mandatory code review for all tenant-scoped queries. | swe |
| **R-007** | **Performance degradation from event-driven overhead** (latency, throughput drop) due to async message processing | Medium | Medium | Benchmark broker performance in pre-production (TK-004). Set p99 latency SLA (target: <500ms for critical events). Implement event sampling for non-critical events. Monitor event queue depth + consumer lag. Add horizontal scaling for consumers (TK-006). | swe |
| **R-008** | **Rollback complexity** when multiple service versions are deployed with incompatible event schemas or API contracts | High | Medium | Enforce backward-compatible event schemas (TK-005, TK-006). Use schema registry for event versioning. Document rollback procedure per service (TK-012). Require rollback dry-run in staging before Gate D approval. Test blue-green deployment with schema migration rollback scenarios. | devops |

---

## 3. Open Questions

- **Q1: What is the SLA target for the event bus (p99 latency)?**  
  *Owner: architect*  
  *Context: Required to evaluate broker options (Kafka vs. RabbitMQ vs. NATS) and configure consumer concurrency.*

- **Q2: Is an existing event broker deployed, or is this a greenfield deployment?**  
  *Owner: process*  
  **Answer: Greenfield** — No event broker infrastructure exists. Repository analysis shows:
    - No docker-compose or Kubernetes manifests for message bus
    - No apps/services emitting or consuming events
    - No message broker dependencies in package.json
  *Impact: TK-004 must provision the full broker stack (infrastructure + topics + access controls). Add 3-5 days for broker selection, deployment, and smoke testing.*

- **Q3: Are there existing tenant records in any database, or is this a fresh multi-tenant setup?**  
  *Owner: pm*  
  *Context: If tenants already exist in the database, TK-001 (RBAC schema) must include backfill scripts to assign default roles/permissions.*

- **Q4: Which event broker technology has been approved (Kafka, RabbitMQ, NATS, cloud-native)?**  
  *Owner: architect + devops*  
  *Context: Broker choice affects TK-004, TK-005, TK-006 implementation. If cloud-native (AWS EventBridge, GCP Pub/Sub), managed service reduces operational risk but may increase vendor lock-in (affects R-001 mitigation).*

- **Q5: What is the expected tenant scale (# of tenants, events/sec per tenant)?**  
  *Owner: pm*  
  *Context: Impacts event broker sizing (TK-004), database partitioning strategy (TK-003), and observability sampling rates (TK-009). Affects R-007 (performance risk).*

---

## 4. Inter-Agent Dependency Matrix

| Issue (Agent) | Depends On | Gate | Notes |
|---|---|---|---|
| **[PM] PRD + User Stories + AC** | None | Gate A | Foundation for all downstream work. Must complete first. |
| **[DESIGNER] UX Notes + IA + Flows** | PM (stories ready) | Gate A | Can start after PM provides user stories. Informs permission model design. |
| **[PROCESS] Dependencies + Risk Register** | None | Gate A/B | Can run in parallel with PM/Designer. Must complete before Gate B. |
| **[SWE] Technical Approach + Task Breakdown** | PM (AC ready), PROCESS (risks identified) | Gate B | Blocked by Gate A. Needs assumptions validated (Q2, Q4, Q5). |
| **[QA] Test Strategy + Test Cases** | SWE (TK breakdown ready), PM (AC ready) | Gate C | Blocked by Gate B. Requires task list to map test cases. |
| **[DEVOPS] Release Checklist + Rollback Notes** | SWE (tech plan ready) | Gate D | Blocked by Gate B. Requires deployment architecture from SWE. |
| **[SECURITY] Threat Model Lite** | SWE (tech plan ready), DESIGNER (data flows ready) | Gate D | Blocked by Gate B. Requires system architecture + data flow diagrams. |

---

## 5. Dependency Flow (Sequential and Parallel Phases)

### **Phase 0: Intake (Sequential)**
- **Architect**: Normalize issue #25 into Work Item Brief → triggers Phase 1

### **Phase 1: Parallel Planning (Run in Parallel)**
Start all of these concurrently:
- **PM**: Draft PRD, decompose into user stories (US-001…US-00X), write acceptance criteria
- **DESIGNER**: Create UX notes, information architecture, user flows (depends loosely on PM stories, can start drafting)
- **PROCESS**: Write risk register, identify assumptions, map inter-agent dependencies (this deliverable)

**Sync Point**: All Phase 1 agents must complete before **Gate A Review**.

### **Phase 2: Gate A Review (Sequential)**
- **Architect** reviews PM + Designer + Process outputs
- **Gate A Approval** → unlocks Phase 3

### **Phase 3: Technical Planning (Sequential, Blocked by Gate A)**
- **SWE**: Write technical approach, decompose into TK-001…TK-013, document ADRs
  - *Blocked by*: PM (needs AC for scope), PROCESS (needs Q2, Q4, Q5 answered)
  - *Outputs*: docs/architecture/tech-plan.md, TK breakdown in backlog.md

**Sync Point**: SWE must complete before **Gate B Review**.

### **Phase 4: Gate B Review (Sequential)**
- **Architect** reviews SWE technical plan + dependencies
- **Gate B Approval** → unlocks Phase 5 (QA + DevOps + Security in parallel)

### **Phase 5: Quality & Operations Planning (Parallel, Blocked by Gate B)**
Start all of these concurrently:
- **QA**: Map test cases to US IDs, define E2E smoke test scope (TK-013)
- **DEVOPS**: Write release checklist, rollback runbook (TK-012), define CI/CD pipeline
- **SECURITY**: Threat model for RBAC, tenant isolation, auth provider integration

**Sync Point**: All Phase 5 agents must complete before **Gate C and Gate D Reviews**.

### **Phase 6: Gate C & D Reviews (Sequential)**
- **Gate C** (QA approval) → confirms test strategy readiness
- **Gate D** (DevOps + Security approval) → confirms release readiness

### **Phase 7: Backlog Freeze**
- **Architect** merges all outputs into final backlog.md with IDs, dependencies, and DoD

---

## 6. Blocking Assumptions & Circular-Dependency Flags

### **Blocking Assumptions (If Violated, Gate B Stalls)**

1. **A1 Violation (Event Broker Not Greenfield)**  
   *Impact*: If an existing broker exists but is misconfigured or deprecated, TK-004 scope changes from "provision new" to "migrate existing." Adds 5-10 days for migration planning + data reconciliation.  
   *Mitigation*: Q2 answered (greenfield confirmed). No blocker.

2. **A3 Violation (No OIDC Provider Available)**  
   *Impact*: TK-010 (auth integration) cannot proceed. Requires provisioning a new identity provider (2-4 weeks for vendor selection + setup).  
   *Mitigation*: Validate A3 before Gate B (confirm OIDC provider is accessible and supports required flows). **If validation fails**, this is an escalation event: architect must re-plan with PM to either delay MVP launch until provider is available OR approve scope reduction (removing auth-dependent features). Basic authentication is NOT part of the current TK breakdown and would require re-scoping.

3. **A4 Violation (Zero-Downtime Not Required)**  
   *Impact*: Simplifies TK-011 (migrations) significantly. Allows blue-green cutover with brief downtime window.  
   *Mitigation*: Confirm with PM during Gate A review. If downtime is acceptable, reduce migration complexity.

4. **A6 Violation (Multi-Region Required)**  
   *Impact*: Adds 3-4 new TK items (global routing, cross-region replication, data residency). Increases timeline by 2-3 weeks.  
   *Mitigation*: Mark multi-region as "Out of Scope" in Gate A. Defer to post-MVP backlog.

### **Circular-Dependency Flags**

- **None Detected**: Dependency graph is a directed acyclic graph (DAG). Phase 1 agents are fully parallel, Phase 3+ is sequential with no cycles.

- **Potential Soft Dependency**: DESIGNER may want SWE's data model (TK-001) to finalize UX flows. This is a *design-time preference*, not a hard blocker. Mitigation: DESIGNER uses placeholder entity models (e.g., "User has Roles, Roles have Permissions") and validates against SWE output during Gate B review.

---

## 7. TK Dependencies Cross-Check

| TK-ID | Story | Dependencies (TK-IDs) | Notes |
|---|---|---|---|
| **TK-001** | RBAC domain model + DB schema | None | Foundation for all RBAC work. Must complete before TK-002, TK-003. |
| **TK-002** | Permission middleware (API layer) | TK-001 | Requires role/permission schema to query user permissions. |
| **TK-003** | Tenant isolation in query layer | TK-001 | Requires tenant_id column from TK-001 schema. Can run in parallel with TK-002. |
| **TK-004** | Event broker setup (topic/queue provisioning) | None | Greenfield deployment (Q2 confirmed). No dependencies. Can start immediately after Gate B. |
| **TK-005** | Outbox pattern implementation (producer) | TK-001, TK-004 | Requires database schema (TK-001) for outbox table. Requires broker (TK-004) for message publish. |
| **TK-006** | Inbox/idempotency consumer implementation | TK-004, TK-005 | Requires broker (TK-004) and event schema from TK-005. Must implement idempotency keys. |
| **TK-007** | Audit log schema + write path | TK-001 | Requires user/tenant schema to link audit events to actors. |
| **TK-008** | PII scrubbing / redaction in log pipeline | TK-007 | Requires audit log schema to identify PII fields. Can start in parallel if schema is draft. |
| **TK-009** | Observability dashboards (metrics + traces) | TK-004, TK-006, TK-007 | Requires event metrics (TK-004), consumer lag (TK-006), audit log volumes (TK-007). Start after infrastructure tasks complete. |
| **TK-010** | Auth service integration (JWT/OIDC) | None | Can run in parallel with TK-001. Produces JWT claims that TK-002 consumes. |
| **TK-011** | Migration safety tooling (zero-downtime scripts) | TK-001, TK-007 | Requires all schema changes finalized. Add expand-contract wrappers for TK-001, TK-007. |
| **TK-012** | Rollback runbook documentation | TK-011 | Requires migration scripts to document rollback procedure. Covers TK-004 (broker rollback), TK-011 (schema rollback). |
| **TK-013** | E2E smoke test suite for critical paths | TK-002, TK-003, TK-005, TK-006, TK-010 | Requires full stack (auth, RBAC, event flow) to test end-to-end. Last task before release. |

### **Critical Path (Longest Dependency Chain)**
```
TK-001 → TK-002 → TK-013 (RBAC path: 3 tasks deep)
TK-001 → TK-005 → TK-006 → TK-013 (Event path: 4 tasks deep) ← CRITICAL PATH
TK-004 → TK-005 → TK-006 → TK-013 (Event infra path: 4 tasks deep) ← CRITICAL PATH (parallel)
TK-001 → TK-011 → TK-012 (Migration path: 3 tasks deep)
```

**Critical Path**: TK-004 (broker setup) or TK-001 (schema) → TK-005 (outbox) → TK-006 (inbox) → TK-013 (E2E tests)  
**Estimated Duration**: 4 tasks × 3-5 days/task = **12-20 days** (assumes serial execution; can parallelize TK-001 + TK-004)

### **Parallelization Opportunities (Reduce Critical Path)**
- **Batch 1 (Parallel)**: TK-001 (RBAC schema) + TK-004 (Broker setup) + TK-010 (Auth integration)
- **Batch 2 (After Batch 1)**: TK-002 (Middleware) + TK-003 (Tenant isolation) + TK-005 (Outbox) + TK-007 (Audit schema)
- **Batch 3 (After Batch 2)**: TK-006 (Inbox) + TK-008 (PII scrubbing)
- **Batch 4 (After Batch 3)**: TK-009 (Dashboards) + TK-011 (Migrations) 
- **Batch 5 (Final)**: TK-012 (Rollback docs) + TK-013 (E2E tests)

---

## 8. Gate Readiness Checklist

### **Gate A — Product Ready**
**Owner**: pm (+architect)

**Readiness Criteria**:
- [ ] PRD complete (docs/product/prd.md exists)
- [ ] User stories written with testable AC (US-001…US-00X in backlog.md)
- [ ] Assumptions A1–A6 validated (process)
- [ ] Open questions Q1, Q3, Q4, Q5 answered or delegated (Q2 already answered in Section 3: greenfield confirmed)
- [ ] Designer UX notes + flows complete (docs/design/ux-notes.md)
- [ ] Risk register R-001…R-008 reviewed by architect

**Blockers (Red Flags)**:
- Missing AC for any user story
- Q4 (broker choice) unanswered → blocks SWE from starting TK-004
- Q5 (scale estimate) unanswered → blocks performance assumptions in R-007

---

### **Gate B — Tech Ready**
**Owner**: swe (+architect)

**Readiness Criteria**:
- [ ] Technical approach documented (docs/architecture/tech-plan.md)
- [ ] Tasks TK-001…TK-013 decomposed with DoD per task
- [ ] Dependencies between TKs mapped (see Section 7)
- [ ] ADR written if new tech choices made (broker, ORM, auth library)
- [ ] Critical path identified (TK-001/TK-004 → TK-005 → TK-006 → TK-013)
- [ ] All Gate A blockers resolved

**Blockers (Red Flags)**:
- Missing dependency specification for any TK
- Circular dependency detected in TK graph
- A3 (OIDC provider availability) not validated → TK-010 at risk

---

### **Gate C — Quality Ready**
**Owner**: qa

**Readiness Criteria**:
- [ ] Test strategy complete (docs/quality/test-strategy.md)
- [ ] Test cases mapped to US-001…US-00X (one-to-many mapping)
- [ ] E2E smoke test scope defined (TK-013 acceptance criteria)
- [ ] Risk-based test prioritization applied (P0: R-002, R-003, R-006)
- [ ] Performance test plan for R-007 (event throughput benchmarks)
- [ ] All Gate B blockers resolved

**Blockers (Red Flags)**:
- No test cases for high-impact risks (R-002, R-003, R-006)
- TK-013 DoD missing or vague
- No negative test cases for RBAC (unauthorized access scenarios)

---

### **Gate D — Release Ready**
**Owner**: devops (+security)

**Readiness Criteria**:
- [ ] Release checklist complete (docs/devops/release-checklist.md)
- [ ] Rollback runbook documented (TK-012 complete)
- [ ] Threat model lite reviewed (docs/security/threat-model.md)
- [ ] CI/CD pipeline configured for zero-downtime deploy (blue-green or rolling)
- [ ] Monitoring dashboards + alerts configured (TK-009)
- [ ] Secrets management strategy validated (env vars, vault, KMS)
- [ ] All Gate C blockers resolved

**Blockers (Red Flags)**:
- No rollback procedure for TK-004 (broker config changes)
- No rollback procedure for TK-011 (schema migrations)
- Missing PII redaction validation (R-003 unmitigated)
- No incident response plan for R-001 (broker outage), R-005 (auth provider outage)

---

## 9. Post-Gate D Validation (Pre-Merge Checklist)

Before architect merges final backlog:
- [ ] All open questions Q1–Q5 answered or marked "deferred to implementation"
- [ ] All risks R-001…R-008 have assigned owners + mitigation plans
- [ ] Critical path duration estimated (12-20 days baseline)
- [ ] Parallelization batches defined (see Section 7)
- [ ] Each TK has clear DoD (testable, atomic)
- [ ] Each US has clear AC (Given/When/Then format preferred)
- [ ] Dependencies cross-checked: no orphaned TKs, no circular deps
- [ ] Gate checklists above integrated into docs/agile/workflow.md

**Architect Final Sign-Off**: Confirms all agents' outputs are consistent, complete, and ready for backlog freeze.