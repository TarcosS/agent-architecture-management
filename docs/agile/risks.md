# Risks & Assumptions — Issue #25: Multi-App Platform

## Assumptions
- A1: The monorepo uses a consistent package manager (pnpm workspaces) across apps/web, API services, workers, and shared packages.
- A2: An existing database (PostgreSQL assumed) is in place; migration approach will build on it rather than replacing it.
- A3: No production traffic at this stage; planning artifacts are docs-only and do not require live environment validation.
- A4: All agents operate within the same GitHub repository and can read/write to `docs/` without conflicts.
- A5: Secrets management tooling (e.g., HashiCorp Vault or cloud-native secrets manager) is available or can be specified as a requirement.
- A6: PII is present in at least some API request/response shapes and must be identified before observability pipeline design is finalized.

## Risk Register
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---:|---:|---|---|
| R-001 | Tenant isolation strategy chosen (row-level vs schema-per-tenant) may not align with existing DB schema, requiring significant migration work | Medium | High | SWE to document both options with migration cost assessment in TK-002; architect to decide before Gate B | swe |
| R-002 | Event bus technology selection (EP-002) could be blocked if existing infrastructure constraints are undocumented | Medium | High | Process agent to map infrastructure dependencies in Gate A; unblock ADR (TK-004) before Gate B | process |
| R-003 | PII fields in API responses may be broader than anticipated, causing scope creep in masking rules (TK-007) | High | Medium | PM to bound PII scope in PRD; include explicit out-of-scope fields list; time-box PII registry to 1 sprint | pm |
| R-004 | Audit log immutability requirement may conflict with data retention/GDPR right-to-erasure obligations | Medium | High | Security (lead) to flag in threat model (TK-012); PM collaborates to document legal constraints in PRD; architect adjudicates final decision | security (lead); pm + architect collaborating |
| R-005 | Blue/green deployment requires infrastructure support (load balancer, environment duplication) that may not exist yet | Medium | High | DEVOPS to document prerequisites in TK-008; flag as infrastructure dependency requiring environment validation before Gate D | devops |
| R-006 | STRIDE analysis may identify HIGH-severity threats that require architectural rework before Gate D can be passed | Low | Critical | Security agent to surface threats early (draft before Gate B); architect reviews at Gate B so SWE can address in tech plan | security |
| R-007 | Cross-agent document conflicts (e.g. SWE tech plan contradicts PM scope) could cause rework at Gate B | Medium | Medium | Architect reviews all Gate A outputs before unblocking Gate B; explicit cross-reference check in workflow | architect |
| R-008 | E2E test framework selection (TK-010) may not support RBAC testing patterns natively, requiring custom helpers | Low | Medium | QA to evaluate RBAC test support as explicit criterion in ADR; flag gaps as tech debt items | qa |

## Open Questions
- Q1: Should tenant isolation be row-level security (simpler, one DB) or schema-per-tenant (stronger isolation, more complex migrations)? (Owner: swe → decision needed at Gate B)
- Q2: Is an existing event broker (Redis, Kafka, RabbitMQ) already deployed, or is this greenfield selection? (Owner: process → answer needed before Gate A closes)
- Q3: What is the legal/compliance requirement for audit log retention and GDPR erasure? (Owner: pm → answer needed at Gate A to scope EP-003 correctly)
- Q4: Are there existing secrets in the repo or CI environment that need to be rotated as part of this work? (Owner: security → answer needed before Gate D)
- Q5: Should the blue/green deployment strategy be implemented for all services simultaneously, or can it be phased (web first, then API, then workers)? (Owner: devops → answer needed at Gate B)
