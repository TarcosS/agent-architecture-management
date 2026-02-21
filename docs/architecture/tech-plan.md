# Architecture Tech Plan

## apps/web — Vite Quick Check

### Dev / Build Command Flow

| Step | Command | Notes |
|------|---------|-------|
| Install dependencies | `npm install` | Run from `apps/web/` |
| Start dev server | `npm run dev` → `vite` | HMR on `localhost:5173` (default) |
| Type-check | `tsc -b` | Invoked as part of `build` script |
| Production build | `npm run build` → `tsc -b && vite build` | Output in `apps/web/dist/` |
| Preview prod build | `npm run preview` → `vite preview` | Serves the `dist/` locally |
| Lint | `npm run lint` → `eslint .` | Uses `eslint.config.js` |

### Checklist

- [x] `package.json` scripts confirmed: `dev`, `build`, `lint`, `preview`
- [x] `vite.config.ts` present and uses `@vitejs/plugin-react-swc`
- [x] TypeScript project references configured (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`)
- [x] `index.html` entry point present at `apps/web/index.html`
- [x] No custom Vite port or base-path overrides detected (defaults apply)
- [x] Build output directory is the Vite default (`dist/`)
- [ ] CI pipeline step added to run `npm run build` in `apps/web/` (pending DevOps task)
- [ ] Environment variable strategy documented (`.env` / `.env.production`) — out of scope for this check

### Notes

- Stack: React 19 + TypeScript 5.9 + Vite 7 + SWC (fast transpilation via `@vitejs/plugin-react-swc`)
- No code changes were made under `apps/web/`; this document is **architecture planning only**
- Full DevOps integration (CI/CD) is tracked separately under Gate D
