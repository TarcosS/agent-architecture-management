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

## Execution Topology (DAG + Parallel Pools)
- Model the plan as a dependency DAG, not a strictly linear chain.
- Each work item must declare:
  - Owner agent
  - Dependencies (hard/soft)
  - Gate target
  - Parallel shard key (if split)
- Parallel pools are allowed by capacity (example: multiple SWE and Designer shards running at once).
- Fan-in points are mandatory before gate close and before integration PR.

## PM Governance Loop (Mandatory)
- Every cycle must pass through PM review.
- Required PM checkpoints:
  - After Architect decomposition (scope confirmation)
  - Before each gate close (A/B/C/D)
  - Before opening/updating final integration PR
- PM checkpoint output: concise comment on master issue with approved scope changes, risks, and next-step decision.

## PR Policy (Single Open PR)
- Stakeholder-facing policy: maximum one open integration PR at a time.
- Child agents work through issues/sub-issues and draft artifacts; architect owns integration branch strategy.
- If parallel implementation branches exist, they must be folded into one integration PR before user review.
- No gate advances if open integration PR count is greater than one.

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
