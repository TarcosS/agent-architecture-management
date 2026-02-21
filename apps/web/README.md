# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Tailwind CSS v4 + shadcn/ui

This app uses [Tailwind CSS v4](https://tailwindcss.com/docs/v4-beta) and [shadcn/ui](https://ui.shadcn.com/).

### Setup notes

- **Tailwind v4** is installed via `tailwindcss` + `@tailwindcss/vite`. No `tailwind.config.js` is needed; configuration is CSS-first.
- The Vite plugin is added in `vite.config.ts`. The CSS entry (`src/index.css`) uses `@import "tailwindcss"`.
- **shadcn/ui** is initialized with `npx shadcn@latest init`. Configuration lives in `components.json`.
- The `@` path alias is configured in both `vite.config.ts` (via `resolve.alias`) and `tsconfig.app.json` / `tsconfig.json` (via `paths`).
- shadcn CSS design tokens (HSL variables) are declared in `src/index.css` under `@layer base`.
- UI components live in `src/components/ui/`. A sample `Button` component is included.

### Adding more shadcn components

```bash
npx shadcn@latest add <component-name>
```

### Dev & build commands

```bash
npm run dev     # Start dev server with HMR
npm run build   # TypeScript check + Vite production build
npm run preview # Preview production build
npm run lint    # ESLint
```



## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
