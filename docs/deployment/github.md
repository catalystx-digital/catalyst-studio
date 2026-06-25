# GitHub Actions and Vercel deployment

Catalyst Studio is a server-rendered Next.js application backed by Prisma and PostgreSQL. Production deployments are handled by GitHub Actions and Vercel CLI: GitHub validates the code, builds the Vercel output, runs production migrations with protected database secrets, and deploys that prebuilt output to Vercel.

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

The workflow uses only `contents: read` permissions. It does not require package publishing permissions. Production secrets are scoped to the steps that need them, and the deployment job starts only after a no-secret guard verifies that the triggering CI run came from the current `main` SHA in this repository.

## Required Vercel configuration

Link the GitHub repository to the Vercel project or configure the project IDs through the secrets above. The workflow does not require permission to read or write Vercel project environment variables. Instead, it writes the local Vercel project link and project settings from the protected GitHub configuration, prepares production env files from `VERCEL_ENV_FILE_PRODUCTION`, uses them for `vercel build`, and passes those values to `vercel deploy --prebuilt` with runtime `--env` flags.

`VERCEL_ENV_FILE_PRODUCTION` should include the production app values that Vercel needs during build and function execution, including:

```bash
DATABASE_URL="postgresql://user:password@host:5432/catalyst_studio"
DIRECT_URL="postgresql://user:password@host:5432/catalyst_studio"
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

GitHub environment secrets are the source of truth for deploy credentials, migrations, and app runtime/build configuration. Keep `DATABASE_URL` and `DIRECT_URL` consistent between the dedicated migration secrets and `VERCEL_ENV_FILE_PRODUCTION`.

## Deployment sequence

On a successful `CI` run for `main`, the deploy workflow:

1. Verifies the CI run was a successful push to the current `main` SHA in this repository.
2. Checks out the exact commit that passed CI.
3. Installs dependencies with `npm ci`.
4. Writes `.vercel/project.json` from the protected Vercel project secrets and Vercel project settings.
5. Prepares a production env file from GitHub environment secrets and variables.
6. Runs `vercel build --prod` with that production env loaded.
7. Runs `npm run db:migrate:deploy` with protected `DATABASE_URL` and `DIRECT_URL`.
8. Runs `vercel deploy --prebuilt --prod`, passing runtime env values with `--env`.
9. Smoke-checks the returned Vercel deployment URL and `${NEXT_PUBLIC_APP_URL}/sign-in`.

If the Vercel build fails, migrations do not run. If migrations fail, deployment stops before Vercel receives a new production deployment.

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
| `prisma migrate deploy` cannot connect | `DATABASE_URL` or `DIRECT_URL` is missing, pooled incorrectly, or unreachable from GitHub-hosted runners. | Use a direct production DB URL for `DIRECT_URL` and allow GitHub Actions network access if your DB is firewalled. |
| `vercel build` or `vercel deploy` cannot link the project | `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` is wrong. | Copy the IDs from Vercel project settings or `.vercel/project.json`. |
| Deployment source guard fails | The triggering CI run was not a successful push to the current `main` SHA in this repository. | Let the latest `main` CI run finish, then use its automatic deploy or rerun the deploy manually from `main`. |
| Smoke check fails | `NEXT_PUBLIC_APP_URL` is wrong, the returned Vercel deployment URL is unreachable, or the deployed app is not serving `/sign-in`. | Update the GitHub environment variable and verify the Vercel domains. |

## References

- Vercel GitHub Actions guide: https://vercel.com/docs/git/vercel-for-github
- Vercel build CLI: https://vercel.com/docs/cli/build
- Vercel deploy CLI: https://vercel.com/docs/cli/deploy
