# Risks & Assumptions

## Assumptions
- A1: MCP tools (`issue_write`, `push_files`, `create_or_update_file`) are available and authenticated in the agent environment
- A2: The test issue (#6) is a controlled dry-run; no production changes are expected
- A3: All child issues will be closed once MCP write verification is confirmed

## Risk Register
| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---:|---:|---|---|
| R-001 | MCP authentication failure blocks issue writes | Low | High | Verify token scopes; re-run if 401 occurs | process |
| R-002 | Branch divergence causes push conflicts | Low | Medium | Always fetch latest SHA before file write | swe |
| R-003 | Test issues accumulate and clutter backlog | Medium | Low | Close all child issues after Gate D sign-off | architect |

## Open Questions
- Q1: Should the child issues be closed automatically after verification? (Owner: architect)
