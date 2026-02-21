# CI-Ready Checklist

This checklist must pass before any PR is merged. No GitHub Actions workflow is required yet — run these steps locally or in a CI pipeline when one is added.

## Quality Gates

### Gate 1 — Lint
- [ ] Run `npm run lint` from `apps/web/`
- [ ] Zero ESLint errors (warnings acceptable for now)

### Gate 2 — Test
- [ ] Run `npm run test` from `apps/web/`
- [ ] All tests pass (currently a placeholder — add real tests before Gate C is marked done)

### Gate 3 — Build
- [ ] Run `npm run build` from `apps/web/`
- [ ] TypeScript compilation succeeds with zero errors
- [ ] Vite production build outputs to `apps/web/dist/` without errors

## PR Checklist

- [ ] No changes to business logic (structure/tooling/docs only, unless a feature task is in scope)
- [ ] `docs/agile/backlog.md` updated with relevant task IDs
- [ ] PR title follows `[<AGENT>] <short description>` convention
- [ ] Required headers present in issue (`Parent`, `Owner-Agent`, `Gate`, `Dependencies`)

## Future CI Steps (add when ready)
- Run lint + test + build in GitHub Actions on every PR
- Block merge if any gate fails
- Add coverage threshold once test framework is introduced
