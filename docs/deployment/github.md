# GitHub-based deployment

Catalyst Studio is a server-rendered Next.js application with Prisma/PostgreSQL, so it should be deployed as a running Node.js container rather than as static GitHub Pages. The included GitHub Actions workflow uses the free minutes available to public/open-source repositories to build a Docker image, publish it to GitHub Container Registry (GHCR), and optionally roll it out to a Docker host over SSH.

## What the workflow does

The workflow in `.github/workflows/deploy.yml` validates deployment-related pull requests, runs on pushes to `main`, and supports manual dispatch:

1. Builds the production Docker image.
2. On pull requests, loads the image locally without publishing it.
3. On `main`/manual runs, pushes the image to `ghcr.io/<owner>/<repo>:main` and `ghcr.io/<owner>/<repo>:<sha>`.
4. If SSH deployment secrets are configured, connects to your host, writes the production `.env`, runs `prisma migrate deploy`, and restarts the container.

The Vercel-specific project configuration has been removed; runtime settings now come from normal GitHub Actions secrets and your production environment file.

## Required repository settings

In GitHub, go to **Settings → Actions → General → Workflow permissions** and enable:

- **Read and write permissions**
- **Allow GitHub Actions to create and approve pull requests** is not required for deploys.

The workflow uses the built-in `GITHUB_TOKEN` for GHCR publishing, so you do **not** need to create a personal access token for the default package push.

The Docker build also receives safe defaults for `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, and `IMPORT_MODEL_CHAIN` so pull-request validation works before repository variables are configured. For production, set repository variables for any values that should be baked into the client build.

## Required secrets

Add secrets at **Settings → Secrets and variables → Actions → New repository secret**.

### Always required for the deployed app

Create a production `.env` file locally, then base64 encode it and store it as `GITHUB_DEPLOY_ENV_B64`:

```bash
base64 -w 0 .env.production
```

On macOS, use:

```bash
base64 < .env.production | tr -d '\n'
```

Minimum production values:

```bash
DATABASE_URL="postgresql://user:password@host:5432/catalyst_studio"
DIRECT_URL="postgresql://user:password@host:5432/catalyst_studio"
AUTH_SECRET="a-long-random-production-secret"
NEXT_PUBLIC_APP_URL="https://your-domain.example"
NEXT_PUBLIC_APP_NAME="Catalyst Studio"
NODE_ENV="production"
STUDIO_DISABLE_WORKFLOW_PLUGIN="true"
STUDIO_QUOTA_ENFORCEMENT_MODE="log"
STUDIO_MEDIA_STORAGE_PROVIDER="S3"
STUDIO_MEDIA_STORAGE_S3_BUCKET="your-bucket"
STUDIO_MEDIA_STORAGE_S3_REGION="your-region"
STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL="https://cdn-or-bucket-url.example"
STUDIO_MEDIA_STORAGE_S3_ACCESS_KEY_ID="..."
STUDIO_MEDIA_STORAGE_S3_SECRET_ACCESS_KEY="..."
```

Add optional secrets inside the same env file when you enable those features:

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

### Required only for automatic SSH rollout

If you only want to publish images to GHCR, skip these. If you want GitHub Actions to restart the app on a server, add:

| Secret | Description |
| --- | --- |
| `DEPLOY_HOST` | Hostname or IP address of the Docker server. |
| `DEPLOY_USER` | SSH username on that server. |
| `DEPLOY_SSH_PRIVATE_KEY` | Private key that can SSH to the server. Use a deploy-only key. |
| `DEPLOY_PORT` | Optional SSH port. Defaults to `22`. |
| `DEPLOY_APP_DIR` | Optional app directory on the server. Defaults to `/opt/catalyst-studio`. |
| `DEPLOY_APP_PORT` | Optional public host port. Defaults to `3000`. |

Generate a deploy key:

```bash
ssh-keygen -t ed25519 -C "github-actions-catalyst-studio" -f ./catalyst_studio_deploy_key
```

Install the public key on your server:

```bash
ssh-copy-id -i ./catalyst_studio_deploy_key.pub deploy@your-server
```

Paste the private key contents into `DEPLOY_SSH_PRIVATE_KEY`:

```bash
cat ./catalyst_studio_deploy_key
```

## Server prerequisites

On the server, install Docker and make sure the deploy user can run Docker:

```bash
sudo usermod -aG docker deploy
```

Log out and back in after changing group membership.

If your GHCR package is private, authenticate Docker on the server once with a GitHub token that has `read:packages` permission:

```bash
echo YOUR_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Public packages do not need a server-side GHCR token.

## Manual rollback

Use any previously published SHA tag:

```bash
docker pull ghcr.io/<owner>/<repo>:<sha>
docker stop catalyst-studio || true
docker rm catalyst-studio || true
docker run -d --name catalyst-studio --restart unless-stopped --env-file /opt/catalyst-studio/.env -p 3000:3000 ghcr.io/<owner>/<repo>:<sha>
```

## How to test the GitHub workflow

### 1. Test on every deployment PR

The deploy workflow now runs on pull requests that touch deployment-related files. On a PR, it builds the Docker image but does **not** log in to GHCR, publish packages, run migrations, or SSH to a server. This catches Dockerfile and workflow regressions before merge without needing production secrets.

Expected PR behavior:

- `build-and-publish` runs.
- `Build and push image` shows `push: false` and `load: true`.
- `deploy-ssh` is skipped.

### 2. Test image publishing manually

After merging, open **Actions → Deploy → Run workflow**. This publishes the image to GHCR and only attempts SSH rollout if all rollout secrets exist.

Expected behavior without SSH secrets:

- The image is published to `ghcr.io/<owner>/<repo>:main` and `ghcr.io/<owner>/<repo>:<sha>`.
- The SSH job prints `SSH deployment secrets are incomplete; image was published to GHCR only.` and exits successfully.

### 3. Test SSH rollout safely

Before pointing at production, create a temporary Docker host or staging VM and configure the SSH secrets for that host. Use a staging `GITHUB_DEPLOY_ENV_B64` with a staging database URL. Run the workflow manually and verify:

```bash
ssh deploy@your-staging-host "docker ps --filter name=catalyst-studio"
ssh deploy@your-staging-host "docker logs --tail 100 catalyst-studio"
curl -I https://your-staging-domain.example
```

### 4. Common GitHub Actions errors

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `denied: permission_denied: write_package` | Workflow token cannot write packages. | In **Settings → Actions → General**, set workflow permissions to **Read and write permissions**. |
| Docker build sees an empty app URL | `NEXT_PUBLIC_APP_URL` repository variable is missing. | Add **Settings → Secrets and variables → Actions → Variables → NEXT_PUBLIC_APP_URL**. The workflow has a localhost fallback for PR validation. |
| SSH rollout is skipped | One or more rollout secrets are missing. | Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PRIVATE_KEY`, and `GITHUB_DEPLOY_ENV_B64`. |
| `docker pull ghcr.io/...` fails on your server | GHCR package is private or server is not logged in. | Make the package public or run `docker login ghcr.io` on the server with a token that has `read:packages`. |
| `prisma migrate deploy` fails | Production env file is missing `DATABASE_URL` or `DIRECT_URL`, or the database is unreachable. | Update `.env.production`, regenerate `GITHUB_DEPLOY_ENV_B64`, and rerun the workflow. |

## Why PR checks can fail

This PR previously failed for two build-time reasons:

1. The Docker deps stage copied only `package.json` and `package-lock.json`, but `npm ci` runs the project `postinstall` script (`prisma generate`). Prisma needs `prisma/schema.prisma`, so the Docker build failed before dependencies finished installing. The Dockerfile now copies `prisma/` before `npm ci`.
2. The app used `next/font/google`, which requires fetching Google font CSS during `next build`. In restricted CI/build environments this can fail with `Failed to fetch font`. The root layout now uses local CSS font-family variables instead of network-fetched build-time fonts.
