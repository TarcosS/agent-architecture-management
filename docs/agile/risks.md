# Risks & Assumptions

## Assumptions
- A1: The existing Vite React TS boilerplate in /apps/web is stable and does not require immediate code changes for agent-agile integration
- A2: All agents (pm, swe, qa, devops, process, designer, security) are available and can be assigned child issues for parallel execution
- A3: The current agent registry in /agents/ is complete and accurate for delegation purposes
- A4: GitHub issue templates and agent markdown files in .github/ are sufficient for creating child issues with proper labels and headers
- A5: No additional dependencies or external integrations are required for the initial agent-agile setup phase
- A6: Documentation structure under /docs/ follows the expected pattern and agents will follow the convention (product/, architecture/, quality/, devops/, security/, design/ subdirectories)

## Risk Register
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---:|---:|---|---|
| R-001 | Agent availability or assignment issues may delay parallel execution | Low | High | Verify agent registry before delegation; have fallback plan for architect to handle critical paths if agents unavailable | architect |
| R-002 | Documentation artifacts may be inconsistent across agents due to parallel execution without sufficient coordination | Medium | Medium | Establish clear templates and header requirements for all artifacts; architect performs final merge and validation in Phase 3 | architect |
| R-003 | Quality gate scripts may not accurately validate artifact completeness leading to false passes | Medium | High | Define explicit validation rules per gate; test scripts with sample artifacts; include both structure and content checks | process |
| R-004 | Scope creep during artifact creation—agents may attempt code implementation despite orchestration-only constraint | Medium | Medium | Clearly state "no PR, no code changes" in all child issue descriptions; architect monitors child issue resolution for compliance | architect |
| R-005 | Child issue creation may be blocked by missing GitHub labels or permission issues | Low | Medium | Verify labels exist (aa:child, aa:delegated-by-architect, gate-a/b/c/d) before creating issues; test issue creation with minimal example first | architect |
| R-006 | Backlog IDs (EP/US/TK) may be referenced incorrectly across documents leading to traceability issues | Low | High | Use consistent ID format (EP-XXX, US-XXX, TK-XXX); validate all cross-references during final merge; never change IDs once assigned | process |

## Open Questions
- Q1: Should quality gate scripts be automated in CI/CD pipeline or remain as manual validation tools? (Owner: devops, process)
- Q2: What testing framework should be adopted for /apps/web (Jest, Vitest, or other)? (Owner: qa, swe)
- Q3: Are there existing GitHub Actions workflows that need to be updated or integrated with agent-agile workflow? (Owner: devops)
- Q4: Should repo-map.md include agent communication patterns or focus solely on directory/file structure? (Owner: process, architect)