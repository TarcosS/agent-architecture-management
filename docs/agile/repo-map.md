# Repo Map

## Work Areas

### Code (`/apps/web`)
All application source lives under `/apps/web`. Agents making code changes should work here only.

| Path | Purpose |
|---|---|
| `apps/web/src/` | React + TypeScript application source |
| `apps/web/src/main.tsx` | Entry point |
| `apps/web/src/App.tsx` | Root component |
| `apps/web/public/` | Static assets served as-is |
| `apps/web/index.html` | HTML shell for Vite |
| `apps/web/vite.config.ts` | Vite configuration |
| `apps/web/eslint.config.js` | ESLint flat config |
| `apps/web/tsconfig*.json` | TypeScript compiler options |
| `apps/web/package.json` | Package manifest + scripts |

### Documentation (`/docs`)
All project documentation lives under `/docs`. Agents making documentation changes should work here only.

| Path | Purpose |
|---|---|
| `docs/agile/workflow.md` | Agent-Agile workflow definition and sprint cadence |
| `docs/agile/backlog.md` | Epics, user stories and tasks (EP/US/TK) |
| `docs/agile/risks.md` | Risk register and open questions |
| `docs/agile/repo-map.md` | This file — describes where to edit code and docs |
| `docs/agile/ci-checklist.md` | CI-ready checklist for quality gates |
| `docs/agile/orchestration-rules.md` | Agent orchestration and delegation rules |

### Agent Definitions (`/agents`)
Agent registry and role descriptions. Only the architect agent should modify these.

## Non-Goals (SWE scope guard)
- **Do not** touch `/agents` unless you are the architect.
- **Do not** change business logic — structure and tooling changes only.
- **Do not** add new packages without a task that explicitly requests it.

## Quality Gate Scripts (run from `apps/web/`)
```
npm run lint    # ESLint — must pass with 0 errors
npm run test    # Unit tests — must pass (placeholder until framework added)
npm run build   # TypeScript check + Vite production build
```
