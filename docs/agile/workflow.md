# Agile Workflow (Agent-Orchestrated)

## Work Item Brief
- **Task:** Verify that MCP write functionality works end-to-end (issue creation, comment, file writes via GitHub MCP tools)
- **Constraints:** Test scope only — no production code changes required; keep changes minimal and reversible
- **Acceptance Criteria:**
  - MCP `issue_write` (create/update) confirmed working
  - MCP `push_files` / `create_or_update_file` confirmed working
  - Child issues created and assigned via MCP
  - Agile docs updated via MCP file-write
- **Notes:** This is a test master issue (#6) created to validate MCP tooling. Agents should treat it as a minimal Gate A–D dry-run.

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
- Owner agent assigned
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