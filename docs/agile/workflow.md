# Agile Workflow (Agent-Orchestrated)

## Work Item Brief
- **Task:** <USER_PROMPT.Task>
- **Constraints:** <USER_PROMPT.Constraints>
- **Acceptance Criteria:** <USER_PROMPT.Acceptance Criteria>
- **Notes:** <USER_PROMPT.Notes>

## Agents In Use (from agents/registry.yaml)
- architect: Orchestration + final merge
- pm: PRD, stories, acceptance criteria
- process: dependencies, risks, SDLC gates
- designer: IA, flows, UX notes
- swe: technical plan, implementation tasks
- qa: test strategy + test cases
- devops: CI/CD + release checklist
- security: threat model lite

## Sprint Cadence (default)
- Sprint length: **1 week**
- Ceremonies:
  - Planning: 45m
  - Daily async check-in: 5–10m (issue comment)
  - Mid-sprint review: 20m
  - Retro: 20m

## Gates (Hard Rules)
### Gate A — Product Ready
**Owner:** pm (+architect)

**Criteria:**
- PRD ready (docs/product/prd.md exists)
- User stories ready with testable AC (US-001…US-00X)
- Acceptance criteria per story ready (Given/When/Then format)
- Assumptions validated (A1–A6 from risks.md)
- Designer UX notes + flows complete
- Risk register reviewed (R-001…R-008)

**Blockers:**
- Missing AC for any user story
- Critical open questions unanswered (e.g., Q4: broker choice)
- Scale estimates missing (Q5)

### Gate B — Tech Ready
**Owner:** swe (+architect)

**Criteria:**
- Tech approach written (docs/architecture/tech-plan.md)
- Dependencies identified (TK-to-TK mapping)
- ADR opened if architectural decision exists
- Tasks TK-001…TK-013 decomposed with DoD
- Critical path identified (see risks.md Section 7)

**Blockers:**
- Circular dependencies detected in TK graph
- Greenfield vs. existing infrastructure unclear (Q2)
- Missing dependency specification for any TK
- OIDC provider availability not validated (A3)

### Gate C — Quality Ready
**Owner:** qa

**Criteria:**
- Test strategy updated (docs/quality/test-strategy.md)
- Test cases mapped to user stories (one-to-many)
- E2E smoke test scope defined (TK-013 DoD clear)
- Risk-based test prioritization applied (P0: R-002, R-003, R-006)
- Performance test plan for event throughput (R-007)

**Blockers:**
- No test cases for high-impact risks
- TK-013 DoD missing or vague
- No negative test cases for RBAC scenarios

### Gate D — Release Ready
**Owner:** devops (+security)

**Criteria:**
- Release checklist ready (docs/devops/release-checklist.md)
- Threat model lite reviewed (docs/security/threat-model.md)
- Rollback notes present (TK-012 complete)
- CI/CD pipeline configured (zero-downtime deploy)
- Monitoring dashboards + alerts configured (TK-009)
- Secrets management strategy validated

**Blockers:**
- No rollback procedure for infrastructure changes (TK-004 broker, TK-011 migrations)
- Missing PII redaction validation (R-003)
- No incident response plan for critical outages (R-001, R-005)

## Parallelization Plan
### Phase 0 — Intake (Architect)
- Normalize prompt into “Work Item Brief”
- Decide epic boundaries (max 6)

### Phase 1 — Parallel Planning (run in parallel)
- pm: PRD + stories + AC
- designer: UX notes + flows
- swe: tech plan + task breakdown
- qa: test strategy outline (draft)
- process: risks + dependency map
- security: threat model lite (draft)
- devops: release checklist draft

### Phase 2 — Gate Reviews (sequential)
- Gate A → Gate B → Gate C → Gate D

### Phase 3 — Backlog Freeze
- Architect merges everything into a single backlog with IDs and dependencies

## Definition of Ready (DoR)
A story is “Ready” if:
- AC is testable (Given/When/Then or bullet test points)
- Dependencies listed
- Owner agent declared in issue body and GitHub custom-agent assignment applied via Copilot MCP (`owner`, `repo`, `issue_number`, `custom_instructions`, `custom_agent`, `model`)
- Scope is bounded (non-goals stated)

## Definition of Done (DoD)
A story is “Done” if:
- Implementation tasks complete (if build stage exists)
- QA test cases written (and executed if build exists)
- Docs updated (where relevant)
- Release checklist items satisfied (if shippable increment)

## Outputs
- `docs/agile/backlog.md`
- `docs/agile/risks.md`
- Supporting:
  - `docs/product/prd.md`
  - `docs/architecture/tech-plan.md`
  - `docs/quality/test-strategy.md`
  - `docs/devops/release-checklist.md`
  - `docs/security/threat-model.md`
  - `docs/design/ux-notes.md`
