# Agent Orchestration Rules

## Golden Rule
- Initial assignment (first delegation) is ONLY done by **architect**.

## Issue Types
- Master: title starts with `[AA]`
- Child: title starts with `[PM]`, `[SWE]`, `[QA]`, `[DEVOPS]`, `[SEC]`, `[DESIGN]`, `[PROCESS]`
- Sub-issue: starts with `[SUB]` and must reference a parent child issue.

## Required Header (for every child/sub issue)
- Parent: #<issue_number>
- Owner-Agent: <agent_id>
- Gate: A|B|C|D|None
- Dependencies: US-### / TK-### / #issue

## Delegation Policy
- Architect can create and assign any child issue.
- Non-architect agents can:
  - create sub-issues
  - assign sub-issues to other agents
  - BUT must keep Parent reference and cannot change Epic/Story IDs.