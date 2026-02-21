# Backlog (EP/US/TK) — Issue #25: Multi-App Platform

## Epics
| ID | Epic | Goal | Scope (In) | Scope (Out) | Owner |
|---|---|---|---|---|---|
| EP-001 | Tenant-Aware RBAC & Permission Model | Define and enforce tenant-scoped roles and permissions across all services | Role taxonomy, permission middleware, tenant isolation | OAuth provider integration (out of scope this sprint) | swe |
| EP-002 | Event Bus + Outbox/Inbox Reliability | Reliable async event delivery with at-least-once guarantees | Event bus tech selection, outbox/inbox pattern, dead-letter handling | Event schema registry versioning (future) | swe |
| EP-003 | Audit Logging + PII-Safe Observability | Tamper-evident audit trail with PII redaction in all log/metric pipelines | Audit log schema, PII masking rules, observability pipeline | Real-time analytics dashboards (future) | swe |
| EP-004 | Release Strategy + Migration Safety | Zero-downtime blue/green releases with safe DB migrations and rollback | Deployment strategy docs, migration runbook, rollback checklist | Automated canary traffic shifting (future) | devops |
| EP-005 | E2E Quality Strategy | Risk-based E2E test coverage prioritizing critical paths | Framework selection ADR, test matrix, critical path scenarios | Performance/load testing (separate track) | qa |
| EP-006 | AuthZ/AuthN + Secrets Threat Model | STRIDE threat model covering auth flows, data boundaries, and secrets handling | Threat analysis, mitigations, secrets rotation plan | Penetration testing execution (separate engagement) | security |

## User Stories
| ID | Epic | User Story | Acceptance Criteria | Owner | Dependencies |
|---|---|---|---|---|---|
| US-001 | EP-001 | As a platform admin, I want to define tenant-scoped roles so that access is isolated per tenant | - AC1: Role definitions documented in `docs/architecture/tech-plan.md`<br>- AC2: Tenant isolation strategy described (row-level vs schema-per-tenant)<br>- AC3: At least 3 role levels defined (admin, member, viewer) | pm | none |
| US-002 | EP-001 | As a developer, I want a permission enforcement middleware spec so that I can implement authz checks consistently | - AC1: Middleware interface spec documented<br>- AC2: Error response contract defined (403 format)<br>- AC3: Bypass/override rules documented for service accounts | swe | US-001 |
| US-003 | EP-002 | As an engineer, I want an event bus technology selected so that async messaging is standardized | - AC1: ADR created comparing at least 2 options (e.g. Redis Streams vs BullMQ vs NATS)<br>- AC2: Selection criteria include: ordering guarantees, retry semantics, monorepo compatibility<br>- AC3: Decision documented in `docs/architecture/tech-plan.md` | swe | none |
| US-004 | EP-002 | As an engineer, I want an outbox/inbox pattern design so that event delivery is reliable even during failures | - AC1: Outbox table schema defined<br>- AC2: Polling vs CDC approach documented with trade-offs<br>- AC3: Dead-letter queue strategy specified | swe | US-003 |
| US-005 | EP-003 | As a compliance officer, I want an audit log schema so that all sensitive actions are recorded tamper-evidently | - AC1: Audit log fields defined (actor, action, resource, timestamp, tenant_id)<br>- AC2: Immutability strategy documented (append-only or signed entries)<br>- AC3: Retention policy noted | pm | none |
| US-006 | EP-003 | As a privacy engineer, I want a PII fields registry so that sensitive data is masked in all log/metric outputs | - AC1: PII field inventory documented for all API request/response shapes<br>- AC2: Masking/redaction rules specified per field type<br>- AC3: Test cases defined for PII leakage in logs | swe | US-005 |
| US-007 | EP-004 | As a release engineer, I want a blue/green deployment strategy so that releases are zero-downtime | - AC1: Blue/green topology documented for web + API + worker services<br>- AC2: Traffic cutover procedure described<br>- AC3: Health check gates defined | devops | none |
| US-008 | EP-004 | As a release engineer, I want a DB migration rollback runbook so that failed migrations can be safely reverted | - AC1: Migration naming convention documented<br>- AC2: Forward/rollback SQL approach specified<br>- AC3: Pre-migration checklist defined (backup, lock strategy) | devops | US-007 |
| US-009 | EP-005 | As a QA lead, I want an E2E test framework selected so that critical flows can be automated consistently | - AC1: Framework ADR created comparing at least 2 options (e.g. Playwright vs Cypress)<br>- AC2: Selection considers: monorepo structure, CI integration, RBAC test support<br>- AC3: Decision documented in `docs/quality/test-strategy.md` | qa | US-001, US-003 |
| US-010 | EP-005 | As a QA lead, I want a risk-based test prioritization matrix so that critical paths are tested first | - AC1: Risk matrix defined with probability × impact scoring<br>- AC2: Top 5 critical scenarios identified and documented<br>- AC3: Test coverage mapped to US-001…US-008 | qa | US-009 |
| US-011 | EP-006 | As a security engineer, I want a STRIDE threat analysis for authz/authn flows so that risks are documented | - AC1: STRIDE categories applied to login, token exchange, and permission check flows<br>- AC2: At least 5 threats identified with severity ratings<br>- AC3: Mitigations documented in `docs/security/threat-model.md` | security | US-001, US-002 |
| US-012 | EP-006 | As a security engineer, I want a secrets handling and data boundary model so that sensitive config is secure | - AC1: Secrets inventory documented (DB creds, API keys, signing keys)<br>- AC2: Vault/secrets manager integration approach specified<br>- AC3: Data boundary diagram shows tenant isolation and service mesh trust zones | security | US-001, US-006 |

## Tasks
| ID | Story | Task | Owner Agent | Dependencies | Definition of Done |
|---|---|---|---|---|---|
| TK-001 | US-001 | Define tenant role taxonomy (admin/member/viewer + service accounts) | swe | none | Role taxonomy doc in `docs/architecture/tech-plan.md` |
| TK-002 | US-001 | Document tenant isolation strategy (row-level security vs schema-per-tenant) | swe | TK-001 | Strategy written with trade-offs and recommendation |
| TK-003 | US-002 | Write permission enforcement middleware interface spec | swe | TK-001 | Middleware spec with error contract and bypass rules documented |
| TK-004 | US-003 | Create ADR for event bus technology selection | swe | none | ADR with comparison table, decision, and rationale in `docs/architecture/` |
| TK-005 | US-004 | Design outbox/inbox pattern with dead-letter strategy | swe | TK-004 | Outbox schema + polling vs CDC analysis documented |
| TK-006 | US-005 | Define audit log schema with immutability and retention strategy | swe | none | Audit log schema documented in `docs/architecture/tech-plan.md` |
| TK-007 | US-006 | Build PII fields registry and masking rules per field type | swe | TK-006 | PII registry document with per-field masking rules |
| TK-008 | US-007 | Document blue/green deployment topology for web + API + worker | devops | none | Blue/green topology diagram and procedure in `docs/devops/release-checklist.md` |
| TK-009 | US-008 | Write DB migration rollback runbook with naming convention | devops | TK-008 | Migration runbook template with rollback SQL approach documented |
| TK-010 | US-009 | Create E2E framework ADR (Playwright vs Cypress or equivalent) | qa | none | ADR in `docs/quality/` with selection criteria and decision |
| TK-011 | US-010 | Define risk-based test prioritization matrix with top 5 critical scenarios | qa | TK-010 | Risk matrix + coverage table in `docs/quality/test-strategy.md` |
| TK-012 | US-011 | Perform STRIDE threat analysis for authz/authn flows | security | TK-001, TK-003 | STRIDE table with 5+ threats, severity, and mitigations in `docs/security/threat-model.md` |
| TK-013 | US-012 | Document secrets inventory and vault/secrets manager integration plan | security | TK-001, TK-007 | Secrets inventory + data boundary diagram in `docs/security/threat-model.md` |

## Parallel Work Batches

### Batch A — Gate A (PM + DESIGN + PROCESS in parallel)
- US-001, US-003, US-005, US-007 (no cross-dependencies; can start immediately)
- TK-001, TK-004, TK-006, TK-008 (parallelizable)

### Batch B — Gate B (SWE — depends on Batch A outputs)
- US-002 (depends on US-001 from Batch A), US-004 (depends on US-003), US-006 (depends on US-005), US-008 (depends on US-007)
- TK-002, TK-003, TK-005, TK-007, TK-009

### Batch C — Gate C (QA — depends on Batch B outputs)
- US-009, US-010
- TK-010, TK-011

### Batch D — Gate D (DEVOPS + SEC — SEC can draft earlier)
- US-011, US-012 (security; draft starts in parallel, finalizes after Batch B)
- TK-012, TK-013
