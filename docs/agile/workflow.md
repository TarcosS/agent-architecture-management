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
