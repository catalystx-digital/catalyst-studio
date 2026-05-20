# Contributing

Thanks for contributing to Catalyst Studio.

## Workflow

1. Open an issue or discussion for substantial changes.
2. Keep pull requests focused and small enough to review.
3. Include tests or a clear verification note for behavior changes.
4. Run the relevant checks before opening a pull request.

## Local Checks

```bash
npm run build:components
npm run test:ci
npm run build
```

For Jest suites that do not need a real database:

```powershell
$env:SKIP_DB_SETUP="true"; npm run test -- --runInBand
```

## Code Style

- Use existing project patterns and aliases.
- Keep Studio-specific code under `lib/studio/**`, `app/studio/**`, and `app/api/studio/**`.
- Do not commit local environment files, generated reports, build output, or credentials.
