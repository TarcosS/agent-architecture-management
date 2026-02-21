# Technical Plan: apps/web — Tailwind CSS v4 + shadcn/ui Setup

**Gate:** B  
**Owner-Agent:** swe  
**Dependencies:** US-001 (Gate A), Issue #15  
**Scope:** Docs-first planning only — no code changes under `/apps/web`

---

## Assumptions

1. The Vite app at `apps/web` targets **React 19** with TypeScript and the SWC plugin (`@vitejs/plugin-react-swc`).
2. **Tailwind CSS v4** is the target version; its configuration model differs from v3 (CSS-first config via `@import "tailwindcss"`, no `tailwind.config.js` required by default).
3. **shadcn/ui** will be used via the CLI (`npx shadcn@latest init`) which scaffolds components into `src/components/ui/`.
4. Path aliases (`@/` → `src/`) are required by shadcn/ui and must be configured in both `vite.config.ts` and `tsconfig.app.json`.
5. No monorepo-level CSS reset conflicts exist; `apps/web` is the only frontend app.
6. `node_modules` and build artifacts remain gitignored; only source and config files are tracked.

---

## Proposed Approach

### 1. Tailwind CSS v4 Integration

Tailwind v4 is installed as a Vite plugin (first-class support):

```
npm install tailwindcss @tailwindcss/vite
```

`vite.config.ts` gains the Tailwind plugin:

```ts
import tailwindcss from '@tailwindcss/vite'
// ...
plugins: [react(), tailwindcss()],
```

The global stylesheet (`src/index.css`) imports Tailwind via:

```css
@import "tailwindcss";
```

No `tailwind.config.js` or `postcss.config.js` is needed for the default setup under v4.

### 2. shadcn/ui Scaffolding

Run the initialiser once (interactive CLI):

```
npx shadcn@latest init
```

The CLI will:
- Confirm or prompt for the base colour, CSS variables preference, and component directory (`src/components/ui/`).
- Write `components.json` at the project root.
- Add required peer dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*`).
- Patch `src/index.css` with CSS variable tokens for the chosen theme.

Individual components are added on demand:

```
npx shadcn@latest add button
```

### 3. Path Alias Configuration

shadcn/ui imports components via the `@/` alias. Required changes:

**`tsconfig.app.json`** — `compilerOptions`:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

**`vite.config.ts`** — `resolve.alias`:
```ts
import path from 'path'
// ...
resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
```

`@types/node` is already present in `devDependencies` so `path` import is available.

---

## Data / State Model

No new runtime state is introduced by this setup. Tailwind and shadcn/ui are purely presentational toolchain additions.

---

## API Touchpoints

None — this is a frontend toolchain configuration with no backend or API surface changes.

---

## Risks (Technical)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Tailwind v4 `@tailwindcss/vite` plugin conflicts with existing Vite config or SWC plugin | Low | Medium | Pin compatible version ranges; verify with `vite build` after install |
| R2 | shadcn/ui CLI generates components incompatible with React 19 (peer dep warnings) | Medium | Low | Use `--legacy-peer-deps` if needed; shadcn/ui tracks React 19 support |
| R3 | Path alias `@/` collision with other monorepo packages | Low | Low | Alias is scoped to `apps/web`; no cross-package leakage |
| R4 | CSS variable token naming clash between Tailwind v4 defaults and shadcn/ui theme | Low | Medium | shadcn/ui v4-compatible init rewrites tokens in `index.css` — verify post-init |

---

## Implementation Checklist (mapped to TK IDs)

> **TK-001 — Install Tailwind CSS v4 and configure Vite plugin**

- [ ] Run `npm install tailwindcss @tailwindcss/vite` inside `apps/web`
- [ ] Add `tailwindcss()` to `plugins` array in `vite.config.ts`
- [ ] Replace any existing CSS content in `src/index.css` with `@import "tailwindcss";`
- [ ] Verify Tailwind utility classes render correctly with `npm run dev`
- [ ] Confirm `npm run build` produces no Tailwind-related errors

> **TK-002 — Configure path alias `@/`**

- [ ] Add `baseUrl` and `paths` to `tsconfig.app.json` under `compilerOptions`
- [ ] Add `resolve.alias` mapping `@` → `src/` in `vite.config.ts`
- [ ] Confirm TypeScript language server resolves `@/` imports without errors

> **TK-003 — Initialise shadcn/ui**

- [ ] Run `npx shadcn@latest init` and accept prompts (CSS variables: yes, base colour: neutral or slate)
- [ ] Confirm `components.json` is created at `apps/web/` root
- [ ] Confirm peer dependencies are installed (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`)
- [ ] Confirm `src/index.css` contains shadcn/ui CSS variable tokens
- [ ] Commit `components.json` and generated files under `src/components/ui/` to version control (shadcn/ui components are meant to be owned and customised locally, not treated as opaque node_modules)

> **TK-004 — Validate a sample shadcn/ui component**

- [ ] Run `npx shadcn@latest add button`
- [ ] Import and render `<Button>` in `src/App.tsx` as a smoke test
- [ ] Confirm component renders correctly in `npm run dev`
- [ ] Remove smoke-test import before merging (or keep as a permanent UI element if desired)

---

## Verification Steps for Dev / Build Commands

### Development server

```bash
cd apps/web
npm run dev
# Expected: Vite starts on http://localhost:5173
# Expected: No PostCSS/Tailwind errors in terminal
# Expected: Page renders with Tailwind base reset applied
```

### Production build

```bash
cd apps/web
npm run build
# Expected: TypeScript compiles cleanly (tsc -b exits 0)
# Expected: Vite bundles assets; output in dist/
# Expected: dist/assets/*.css contains purged Tailwind output (file size > 0, not the full 3 MB dev bundle)
```

### Lint

```bash
cd apps/web
npm run lint
# Expected: No ESLint errors related to new imports or shadcn/ui component files
```

### Preview (post-build sanity check)

```bash
cd apps/web
npm run preview
# Expected: Production build served on http://localhost:4173
# Expected: shadcn/ui components styled correctly
```

---

## Implementation Notes

- **US-001 dependency (Gate A):** This plan assumes the base Vite + React scaffold (US-001) is merged and stable before any implementation begins. No changes should be made to `apps/web` source files until Gate A is confirmed.
- **No code changes in this issue:** This document is the Gate B deliverable. Implementation (TK-001 through TK-004) is out of scope for this issue.
- **shadcn/ui component registry:** Components are fetched from the public shadcn registry at init/add time. Ensure CI environments have outbound internet access or use a local mirror.
- **Tailwind v4 CSS-first config:** Unlike v3, content paths are auto-detected by the Vite plugin from the project graph. No `content: []` array is required unless opting into manual control.
