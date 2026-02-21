# Backlog (EP/US/TK)

## Epics
| ID | Epic | Goal | Scope (In) | Scope (Out) | Owner |
|---|---|---|---|---|---|
| EP-001 | MCP Write Verification | Confirm all MCP write tools operate correctly | Issue writes, file writes, comment writes | Production feature work | architect |

## User Stories
| ID | Epic | User Story | Acceptance Criteria | Owner | Dependencies |
|---|---|---|---|---|---|
| US-001 | EP-001 | As an agent, I want to write issues via MCP so that orchestration can delegate work | - Issue created with correct labels<br>- Assignee set correctly | pm | none |
| US-002 | EP-001 | As an agent, I want to write files via MCP so that agile docs stay up to date | - workflow.md, backlog.md, risks.md updated<br>- Changes committed to PR branch | swe | US-001 |
| US-003 | EP-001 | As a QA agent, I want test evidence of MCP writes so that functionality is confirmed | - Child issues exist with correct headers<br>- Docs reflect current master issue | qa | US-001, US-002 |

## Tasks
| ID | Story | Task | Owner Agent | Dependencies | Definition of Done |
|---|---|---|---|---|---|
| TK-001 | US-001 | Create child issues via MCP `issue_write` | architect | none | - All child issues created<br>- Labeled `aa:child` + `aa:delegated-by-architect` |
| TK-002 | US-002 | Update agile docs (workflow, backlog, risks) via MCP file write | swe | TK-001 | - Three docs populated with real content<br>- Committed to PR branch |
| TK-003 | US-003 | Confirm child issues exist and are correctly structured | qa | TK-001 | - Required header present in each child issue<br>- Assignees set |

## Parallel Work Batches
- **Batch A (Planning):** US-001 — architect delegates
- **Batch B (Docs + Verification):** US-002, US-003 — swe + qa in parallel