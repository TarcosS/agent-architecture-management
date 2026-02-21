# Agile Workflow (Agent-Orchestrated)

## Work Item Brief — Issue #25
- **Task:** Design and delegate a complex, multi-stream implementation plan for a monorepo platform with apps/web (Vite), API services, background workers, and shared packages. Test full Agent Architect orchestration quality across product, process, design, engineering, QA, security, and devops tracks.
- **Constraints:**
  - Maintain existing repository structure.
  - Planning artifacts first; implementation may be proposed but not required unless explicitly needed.
  - Enforce Gates A → B → C → D.
  - Stable backlog IDs (EP/US/TK) must be preserved once created.
  - Prefer parallel delegation but keep dependency integrity.
  - No code changes under /apps/web — docs only.
- **Acceptance Criteria:**
  - Architect creates official child issues for PM, DESIGN, PROCESS, SEC, SWE, QA, DEVOPS.
  - Each child issue contains required header (Parent, Owner-Agent, Gate, Dependencies).
  - Child issues are labeled `aa:child` and `aa:delegated-by-architect`.
  - Workflow/backlog/risks docs are updated coherently.
  - Gate readiness criteria are explicit and testable.
  - Cross-agent dependencies are visible and non-contradictory.
  - Open questions and risks are tracked with owners and mitigations.
- **Notes:** Scope covers tenant-aware RBAC, event bus outbox/inbox, audit logging + PII-safe observability, release/migration strategy, E2E quality strategy, and authz/authn threat model.

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
- PRD ready
- User stories ready
- Acceptance criteria per story ready

### Gate B — Tech Ready
**Owner:** swe (+architect)
- Tech approach written
- Dependencies identified
- ADR opened if architectural decision exists

### Gate C — Quality Ready
**Owner:** qa
- Test strategy updated
- Test cases mapped to user stories

### Gate D — Release Ready
**Owner:** devops (+security)
- Release checklist ready
- Threat model lite reviewed
- Rollback notes present (if applicable)

## Parallelization Plan
### Phase 0 — Intake (Architect)
- Normalize prompt into "Work Item Brief"
- Decide epic boundaries (max 6)
- Master issue: #25

### Phase 1 — Parallel Planning (Gate A — run in parallel)
All of the following run concurrently once Phase 0 is complete:
- **pm** (child of #25): PRD + user stories US-001…US-012 + acceptance criteria — Gate A
- **designer** (child of #25): UX notes + permission flows + IA for RBAC UI + observability dashboards — Gate A
- **process** (child of #25): Dependency map + risk register refinement — Gate A/B

### Phase 2 — Technical Planning (Gate B — depends on Gate A outputs)
- **swe** (child of #25): Tech plan for RBAC middleware, event bus, outbox/inbox, observability pipeline, task breakdown — Gate B

### Phase 3 — Quality & Compliance (Gate C/D — depends on Gate B outputs)
- **qa** (child of #25): Test strategy + test cases mapped to US-001…US-012 with risk-based prioritization — Gate C
- **security** (child of #25): STRIDE threat model for authz/authn, data boundaries, PII, secrets handling — Gate D *(draft starts in parallel; finalizes at Gate D)*

### Phase 4 — Release Readiness (Gate D — depends on Gate C + SEC outputs)
- **devops** (child of #25): Release checklist + env notes + rollback + migration safety — Gate D

### Phase 5 — Backlog Freeze (Architect)
- Merge all artifacts into final backlog
- Validate gate readiness criteria
- Resolve any cross-agent conflicts

## Gate Readiness Criteria (Issue #25)

### Gate A — Product Ready *(testable)*
**Owner:** pm (+architect)
- `docs/product/prd.md` exists and covers all 6 scope areas (RBAC, event bus, observability, release, QA strategy, threat model)
- All US-001…US-012 have testable acceptance criteria (Given/When/Then)
- UX notes and flows exist for RBAC management UI and observability dashboards (`docs/design/ux-notes.md`)
- Cross-agent dependency map is complete and non-contradictory
- No unresolved open questions blocking Gate B

### Gate B — Tech Ready *(testable)*
**Owner:** swe (+architect)
- `docs/architecture/tech-plan.md` updated with design decisions for RBAC, event bus, outbox, observability
- ADRs opened for: event bus technology, PII masking approach, secrets vault strategy
- All TK-001…TK-013 have assigned agents, owners, and definitions of done
- No blocking ambiguities remain for implementation

### Gate C — Quality Ready *(testable)*
**Owner:** qa
- `docs/quality/test-strategy.md` updated with E2E framework choice + risk-based prioritization matrix
- Test cases cover all US-001…US-012 (at least 1 test case per story)
- Critical path scenarios covered: RBAC enforcement, event delivery guarantee, audit trail integrity
- PII data masking covered by dedicated negative test cases

### Gate D — Release Ready *(testable)*
**Owner:** devops (+security)
- `docs/devops/release-checklist.md` covers blue/green deployment, zero-downtime migration, and rollback steps
- `docs/security/threat-model.md` addresses authz/authn, data boundaries, PII, and secrets rotation
- All HIGH/CRITICAL threat items have mitigations or accepted-risk notes with owner sign-off
- No secrets committed; vault integration plan documented

## Definition of Ready (DoR)
A story is "Ready" if:
- AC is testable (Given/When/Then or bullet test points)
- Dependencies listed
- Owner agent declared in issue body and GitHub custom-agent assignment applied via Copilot MCP (`owner`, `repo`, `issue_number`, `custom_instructions`, `custom_agent`, `model`)
- Scope is bounded (non-goals stated)

## Definition of Done (DoD)
A story is "Done" if:
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
