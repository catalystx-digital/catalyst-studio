# Node 24 Stabilization Notes

## Breaking Changes

- Node.js 24.x is now required locally, in GitHub Actions, Docker, and Vercel. Node 20 and 22 are no longer supported for this release.
- `postinstall` no longer runs `prisma generate`. After every fresh install, run:

```bash
npm ci
npm run db:generate
```

- Mutating internal workflow APIs now require `x-workflow-internal: $WORKFLOW_INTERNAL_SECRET` in production. `VERCEL_AUTOMATION_BYPASS_SECRET` only bypasses Vercel Deployment Protection and no longer authorizes app API mutations.

## Required Environment Changes

- Add `WORKFLOW_INTERNAL_SECRET` to GitHub `production` environment secrets and Vercel runtime/build env. Generate it with `openssl rand -base64 32`.
- Rotate any Kontent.ai Management API token that may have been copied from older debug scripts. `scripts/debug/export/run-kontent-sync.ts` now requires `KONTENT_ENVIRONMENT_ID` and `KONTENT_MANAGEMENT_API_KEY` from env.
- Do not use `STUDIO_MEDIA_STORAGE_PROVIDER="FILE"` for Vercel production uploads. Use durable storage such as S3-compatible object storage.

## Dependency Upgrades

- Next.js and `eslint-config-next` 15.5.x
- Prisma and `@prisma/client` 6.19.x
- AWS SDK packages 3.1075.x
- Vercel Blob 2.5.x and Vercel Sandbox 1.10.x
- Workflow SDK 4.5.x
- Nodemailer 9.x
- jsPDF 4.x
- fast-xml-parser 5.x
- uuid 11.1.x

These upgrades affect deploy/build output, database client generation, import sitemap XML parsing, email sending, PDF generation, workflow execution, media storage SDK calls, and sandbox lifecycle code. The release includes no-network smoke coverage for several runtime entry points; provider-specific S3, Vercel Sandbox, and Workflow execution checks should remain part of staged rollout validation.

## Release Checklist

- `npm ci`
- `npm run db:generate`
- `npm run typecheck`
- `npm run test:ci`
- `npm audit --omit=dev --audit-level=high`
- `STUDIO_DISABLE_WORKFLOW_PLUGIN=true npm run build`
- `npm run verify:quickstart`
- Vercel production deploy validation fails cleanly if `WORKFLOW_INTERNAL_SECRET` is absent.

## Follow-Up Issues

- Add a dedicated hosted media storage setup guide for S3-compatible object storage.
- Continue auditing workflow/internal API callers for consistent use of `getInternalApiHeaders()` or `callInternalApi()`.
- Track Node 24 ecosystem regressions separately after release.
- Consider adding a local preflight command that validates Node version, Prisma client generation, and required env vars.
