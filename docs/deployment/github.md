# GitHub Actions and Vercel deployment

Catalyst Studio is a server-rendered Next.js application backed by Prisma and PostgreSQL. Production deployments are handled by GitHub Actions and Vercel CLI: GitHub validates the code, builds the Vercel output, creates an unaliased production deployment, runs production migrations with protected database secrets, and promotes the deployment after migrations pass.

## Workflow behavior

The repository has two workflows:

1. `CI` runs on pull requests and pushes to `main`.
2. `Production Deploy` runs only after a successful `CI` workflow on `main`, or by manual dispatch from `main`.

Pull requests do not deploy and do not receive production secrets. Stale CI runs are cancelled automatically, including older `main` runs. Production deploys still verify that the completed CI run belongs to the current `main` SHA before any production secrets are exposed.

## Required GitHub configuration

Create a GitHub Actions environment named `production` at **Settings -> Environments**. Restrict deployments to the `main` branch. Add required reviewers if production deploys should need human approval.

Add these `production` environment secrets:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Vercel token used by the CLI. |
| `VERCEL_ORG_ID` | Vercel team or user ID for the linked project. |
| `VERCEL_PROJECT_ID` | Vercel project ID. |
| `DATABASE_URL` | Production runtime database URL. This may be pooled if your database provider recommends pooling for the app. |
| `DIRECT_URL` | Direct, non-pooled production database URL for `prisma migrate deploy`. |
| `VERCEL_ENV_FILE_PRODUCTION` | Dotenv-formatted production app environment used for Vercel build and runtime deployment. Do not include Vercel system variables, deployment metadata, or `VERCEL_TOKEN`. |

Add these `production` environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public production URL used by the build, deployed runtime, and post-deploy smoke check. Example: `https://studio.example.com`. |
| `NEXT_PUBLIC_APP_NAME` | Optional public application name. Defaults to `Catalyst Studio` if omitted. |
| `STUDIO_DISABLE_WORKFLOW_PLUGIN` | Optional runtime mode flag. Defaults to `true` if omitted. |
| `STUDIO_QUOTA_ENFORCEMENT_MODE` | Optional quota mode. Defaults to `log` if omitted. |
| `VERCEL_PROJECT_NAME` | Optional Vercel project name for the local project link. Defaults to `catalyst-studio` if omitted. |
| `VERCEL_PROJECT_CREATED_AT` | Optional Vercel project creation timestamp in milliseconds. Defaults to the current production project metadata. |
| `VERCEL_PROJECT_FRAMEWORK` | Optional Vercel framework setting. Defaults to `nextjs`. |
| `VERCEL_PROJECT_NODE_VERSION` | Optional Vercel Node runtime setting. Defaults to `24.x`. |
| `VERCEL_TEAM_SLUG` | Vercel team slug used as the CLI `--scope`, for example `coding-koala`. |

The workflow uses only `contents: read` permissions. It does not require package publishing permissions. Production secrets are scoped to the steps that need them, and the deployment job starts only after a no-secret guard verifies that the triggering CI run came from the current `main` SHA in this repository.

## Required Vercel configuration

Link the GitHub repository to the Vercel project or configure the project IDs through the secrets above. Vercel Git auto-deploys must not be a second production deployment path; disable or ignore Vercel Git builds for this project so GitHub Actions remains the only production promotion path. The workflow does not require permission to read or write Vercel project environment variables. Instead, it writes the local Vercel project link and project settings from the protected GitHub configuration, prepares production env files from `VERCEL_ENV_FILE_PRODUCTION`, uses them for `vercel build`, and passes those values to `vercel deploy --prebuilt --skip-domain` with runtime `--env` flags. All Vercel CLI commands run with `--scope "$VERCEL_TEAM_SLUG"` so deploy promotion stays under the target team rather than the token owner's personal scope.

`VERCEL_ENV_FILE_PRODUCTION` should include the production app values that Vercel needs during build and function execution, including:

```bash
AUTH_SECRET="a-long-random-production-secret"
AUTH_SESSION_SECRET="a-long-random-production-secret"
```

Do not include Vercel-provided system variables such as `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_*`, `VERCEL_OIDC_TOKEN`, or the CLI `VERCEL_TOKEN`. The workflow filters those names if they are present, but keeping the secret file clean makes review safer.

Add optional provider values to `VERCEL_ENV_FILE_PRODUCTION` when enabling those features:

```bash
OPENROUTER_API_KEY="..."
OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"
IMPORT_MODEL_CHAIN="x-ai/grok-4.1-fast"
CMS_PROVIDER="auto"
OPTIMIZELY_CLIENT_ID="..."
OPTIMIZELY_CLIENT_SECRET="..."
KONTENT_ENVIRONMENT_ID="..."
KONTENT_MANAGEMENT_API_KEY="..."
CONTENTSTACK_API_KEY="..."
CONTENTSTACK_MANAGEMENT_TOKEN="..."
STUDIO_ENCRYPTION_MODE="required"
STUDIO_ENCRYPTION_KEY_ID="v1"
STUDIO_ENCRYPTION_KEY="base64-encoded-32-byte-key"
```

GitHub environment secrets are the source of truth for deploy credentials, migrations, and app runtime/build configuration. The dedicated `DATABASE_URL` and `DIRECT_URL` secrets are authoritative for both migrations and the Vercel build/runtime env. If those keys are also present in `VERCEL_ENV_FILE_PRODUCTION`, the workflow fails unless they match the dedicated secrets.

## Deployment sequence

On a successful `CI` run for `main`, the deploy workflow:

1. Verifies the CI run was a successful push to the current `main` SHA in this repository.
2. Checks out the exact commit that passed CI.
3. Installs dependencies with `npm ci`.
4. Writes `.vercel/project.json` from the protected Vercel project secrets and Vercel project settings.
5. Verifies the Vercel project name and ID resolve to the intended `coding-koala/catalyst-studio` project before build or deploy.
6. Prepares a production env file from GitHub environment secrets and variables.
7. Runs `vercel build --prod` with that production env loaded.
8. Runs `vercel deploy --prebuilt --prod --skip-domain`, passing runtime env values with `--env`.
9. Runs `npm run db:migrate:deploy` with protected `DATABASE_URL` and `DIRECT_URL`.
10. Smoke-checks the returned Vercel deployment URL before any production alias is promoted, including a DB-backed fake sign-in request that must return `401` instead of `500`.
11. Verifies the checked-out SHA is still the latest `main` SHA.
12. Promotes the production deployment after migrations, staged smoke checks, and the final source guard pass.
13. Smoke-checks `${NEXT_PUBLIC_APP_URL}/sign-in` and the DB-backed fake sign-in request after promotion.

If the Vercel build fails, migrations do not run. If the Vercel token cannot create a production deployment, migrations do not run. If migrations fail, the new Vercel deployment is not promoted to the production domains. If the staged smoke check or promotion fails after migrations have run, production remains on the previous deployment while the database may already be migrated; handle that case with forward-compatible migration design, not automatic rollback.

## Rollback policy

Vercel can roll back application deployments from the Vercel dashboard. Database migrations are not automatically rolled back. Treat production migrations as forward-compatible changes and prefer expand/contract migrations for destructive schema changes.

Before risky migrations:

- Take a database backup or snapshot.
- Deploy backward-compatible schema additions first.
- Remove old columns/tables only after deployed code no longer depends on them.

## Manual deployment

Manual deploys can be run from **Actions -> Production Deploy -> Run workflow**, but the workflow only proceeds from the `main` branch. Manual runs use the selected `main` commit SHA and the same protected production environment, Vercel build, migration step, deployment, and smoke check as automatic deploys.

## Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `VERCEL_TOKEN is required` | Missing GitHub `production` environment secret. | Add all required secrets in the `production` environment. |
| `VERCEL_ENV_FILE_PRODUCTION is required` | Missing GitHub `production` environment secret. | Add the sanitized production dotenv content as a protected environment secret. |
| `DATABASE_URL in VERCEL_ENV_FILE_PRODUCTION must match...` | The runtime/build dotenv content points at a different database than the protected migration secret. | Update the dedicated database secrets and `VERCEL_ENV_FILE_PRODUCTION` so they agree, or remove database URLs from `VERCEL_ENV_FILE_PRODUCTION`. |
| `prisma migrate deploy` cannot connect | `DATABASE_URL` or `DIRECT_URL` is missing, pooled incorrectly, or unreachable from GitHub-hosted runners. | Use a direct production DB URL for `DIRECT_URL` and allow GitHub Actions network access if your DB is firewalled. |
| `vercel build` or `vercel deploy` cannot link the project | `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` is wrong. | Copy the IDs from Vercel project settings or `.vercel/project.json`. |
| `VERCEL_PROJECT_ID points to...` | The protected GitHub secret points at a different Vercel project than `VERCEL_PROJECT_NAME`, such as `coding-koala-website` instead of `catalyst-studio`. | Set `VERCEL_PROJECT_ID` to the ID shown by `vercel project inspect catalyst-studio --scope coding-koala`. |
| `You don't have permission to create a Production Deployment for this project` | `VERCEL_TOKEN` belongs to a user or team role that cannot deploy production for the Vercel project. | Replace `VERCEL_TOKEN` with a token created by a Vercel user/team member allowed to create production deployments for the project. |
| `Not authorized: Trying to access resource under scope ...` during promotion | `VERCEL_TEAM_SLUG` points at the wrong Vercel scope, or the token cannot access that scope. A missing slug is caught earlier by workflow validation. | Set `VERCEL_TEAM_SLUG` to the Vercel team slug that owns the production project and use a token with access to that team. |
| Deployment source guard fails | The triggering CI run was not a successful push to the current `main` SHA in this repository. | Let the latest `main` CI run finish, then use its automatic deploy or rerun the deploy manually from `main`. |
| Smoke check fails | `NEXT_PUBLIC_APP_URL` is wrong, the returned Vercel deployment URL is unreachable, the deployed app is not serving `/sign-in`, or `/api/auth/sign-in` cannot reach the production database with the migrated schema. | Update the GitHub environment variable, verify the Vercel domains, and inspect app/database runtime logs. |

## References

- Vercel GitHub Actions guide: https://vercel.com/docs/git/vercel-for-github
- Vercel build CLI: https://vercel.com/docs/cli/build
- Vercel deploy CLI: https://vercel.com/docs/cli/deploy
