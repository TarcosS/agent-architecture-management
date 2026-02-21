# Backlog (EP/US/TK)

## Epics
| ID | Epic | Goal | Scope (In) | Scope (Out) | Owner |
|---|---|---|---|---|---|
| EP-001 | apps/web Frontend Toolchain | Establish a production-ready Vite + React frontend with Tailwind CSS v4 and shadcn/ui | Vite config, Tailwind v4, shadcn/ui scaffold, path aliases | Backend, auth, routing | architect |

## User Stories
| ID | Epic | User Story | Acceptance Criteria | Owner | Dependencies |
|---|---|---|---|---|---|
| US-001 | EP-001 | As a developer, I want a Vite + React scaffold so that I have a stable base to build on | - Vite dev server starts<br>- TypeScript compiles cleanly<br>- ESLint passes | pm | <none> |
| US-002 | EP-001 | As a developer, I want Tailwind CSS v4 and shadcn/ui configured so that I can build UI components rapidly | - Tailwind utility classes apply in dev and build<br>- shadcn/ui components render correctly<br>- Path alias `@/` resolves | pm | US-001 |

## Tasks
| ID | Story | Task | Owner Agent | Dependencies | Definition of Done |
|---|---|---|---|---|---|
| TK-001 | US-002 | Install Tailwind CSS v4 and configure `@tailwindcss/vite` plugin | swe | US-001 | - `tailwindcss` and `@tailwindcss/vite` in `package.json`<br>- Plugin registered in `vite.config.ts`<br>- `src/index.css` contains `@import "tailwindcss"`<br>- `npm run dev` starts without Tailwind errors<br>- `npm run build` exits 0 |
| TK-002 | US-002 | Configure path alias `@/` in Vite and TypeScript | swe | US-001 | - `tsconfig.app.json` has `baseUrl` and `paths` for `@/*`<br>- `vite.config.ts` has `resolve.alias` for `@`<br>- TS language server resolves `@/` imports without errors |
| TK-003 | US-002 | Initialise shadcn/ui via CLI | swe | TK-001, TK-002 | - `components.json` exists at `apps/web/` root<br>- Peer deps installed (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`)<br>- `src/index.css` contains shadcn/ui CSS variable tokens |
| TK-004 | US-002 | Validate shadcn/ui with a sample component | swe | TK-003 | - `npx shadcn@latest add button` succeeds<br>- `<Button>` renders correctly in dev server<br>- `npm run build` and `npm run lint` exit 0 |

## Parallel Work Batches (optional)
- **Batch A (Gate A — Scaffold):** US-001 → TK-001 unblocked
- **Batch B (Gate B — Toolchain):** TK-001, TK-002 (parallel) → TK-003 → TK-004
- **Batch C (QA):** Smoke tests for US-002 post TK-004