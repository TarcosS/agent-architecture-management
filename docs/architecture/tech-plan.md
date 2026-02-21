# Technical Plan — apps/web (Vite)

## Vite Quick-Check: Dev/Build Command Flow

> Gate A architecture note for `apps/web`. No code changes under `/apps/web`.

### Dev/Build Command Checklist

- [x] **Install dependencies** — `npm install` inside `apps/web/`
- [x] **Development server** — `npm run dev` → invokes `vite`, hot-reload on `http://localhost:5173`
- [x] **Type-check + production build** — `npm run build` → runs `tsc -b` then `vite build`; output written to `apps/web/dist/`
- [x] **Preview production bundle** — `npm run preview` → serves the `dist/` directory locally via Vite
- [x] **Lint** — `npm run lint` → runs ESLint with `typescript-eslint` and React-specific rules

### Confirmed Configuration

| Item | Value |
|---|---|
| Vite version | `^7.3.1` |
| React plugin | `@vitejs/plugin-react-swc` (SWC-based, fast transforms) |
| TypeScript | `~5.9.3`, project references via `tsconfig.app.json` + `tsconfig.node.json` |
| Module format | `"type": "module"` (ESM) |
| Build entry | `index.html` (Vite default) |

### Notes

- The `tsc -b` step in `build` performs a full type-check before bundling; failures here will abort the build.
- No custom `base` or `outDir` is set in `vite.config.ts`; defaults apply (`/` and `dist/`).
- SWC plugin (`@vitejs/plugin-react-swc`) is used instead of Babel for faster dev-server startup.
