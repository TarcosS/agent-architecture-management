# Copilot Auto-Assign (AA Issues)

This automation assigns matching AA issues to GitHub Copilot coding agent and passes custom agent + model via `agent_assignment`.

## Required AA Issue Fields
Include these lines in the issue body:

- `Parent:`
- `Owner-Agent: <architect|pm|designer|process|swe|qa|devops|security>`
- `Gate:`
- `Dependencies:`

Optional:

- `Model: <supported model>`
- Repository variable `COPILOT_ASSIGN_FORCE_MODEL` to enforce one model for all assignments
- Repository variable `COPILOT_ASSIGN_ONLY_ARCHITECT` (default `true`) to restrict Copilot assignment to `Owner-Agent: architect`

The workflow always includes this constraint in `custom_instructions`:

- `No code changes under /apps/web - docs only.`

## What The Workflow Sends
Endpoint:

- `POST /repos/{owner}/{repo}/issues/{issue_number}/assignees`

Payload:

- `assignees: ["copilot-swe-agent[bot]"]`
- `agent_assignment.target_repo`
- `agent_assignment.base_branch`
- `agent_assignment.custom_instructions`
- `agent_assignment.custom_agent`
- `agent_assignment.model` (when forced by repo variable or when `Model:` is present in issue body)

Headers:

- `Accept: application/vnd.github+json`
- `X-GitHub-Api-Version: 2022-11-28`

## Setup
1. Add repository secret:
   - `COPILOT_ASSIGN_TOKEN` (preferred), or reuse `COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN`
2. Token type:
   - Fine-grained PAT or GitHub App user-to-server token.
3. Minimum permissions:
   - Issues: Read and write
   - Contents: Read
   - Pull requests: Read and write (recommended)

Model priority:
1. `vars.COPILOT_ASSIGN_FORCE_MODEL` (if set)
2. `Model:` line in issue body
3. Omit `agent_assignment.model`

Assignment mode:
1. If `COPILOT_ASSIGN_ONLY_ARCHITECT=true`, non-architect issues are not assigned to Copilot and receive an informational comment.
2. Set `COPILOT_ASSIGN_ONLY_ARCHITECT=false` to allow direct assignment for all owner agents.

## Custom Agents Source
Custom agents are read from:

- `.github/agents/*.agent.md`

`Owner-Agent` from issue body is mapped directly to `agent_assignment.custom_agent`.

## Trigger Behavior
Workflow file:

- `.github/workflows/copilot-auto-assign.yml`
- Runtime installs `tsx`, `@actions/core`, `@actions/github` before executing the TypeScript script.

Triggers:

- `issues.opened`
- `issues.edited` (only when body changes)
- `issues.labeled` (only when label is `aa`)

Safety conditions:

- Runs only on default branch workflow ref
- Skips fork repositories
- One concurrent run per issue number
- Even if Copilot is already an assignee, workflow still sends `agent_assignment` to enforce `custom_agent`.

## Troubleshooting Checklist
- Copilot coding agent is enabled in repository settings.
- `.github/agents/<name>.agent.md` exists and `name:` matches `Owner-Agent`.
- `COPILOT_ASSIGN_TOKEN` is present and has required scopes.
- The issue contains `Owner-Agent:` and other AA fields.
- If assignment fails with 403/404, automation posts a troubleshooting comment.
