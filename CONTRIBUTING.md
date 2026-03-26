# Contributing

Thanks for your interest in contributing to Honeydipper Web UI.

## Before you start

- Open an issue describing the bug or feature before a large change.
- Keep pull requests focused and small when possible.
- Include tests for behavior changes.

## Local development

```bash
npm install
npm run dev
```

## Validation

Run these before opening a PR:

```bash
npm test
npm run build
```

## Coding expectations

- Follow the existing component and styling patterns.
- Avoid unrelated refactors in feature/fix PRs.
- Keep UI behavior changes covered by tests where practical.

## Pull request checklist

- [ ] Problem and solution are clearly described.
- [ ] Tests added/updated for changed behavior.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.

## Licensing and contributions

By submitting a contribution, you agree that your contribution may be distributed under:

- AGPL v3 (default project license), and
- a separate commercial license offered by the project owner.

If you do not agree with these terms, please do not submit code.
