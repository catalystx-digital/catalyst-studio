# Scripts

This directory contains standalone scripts for Catalyst Studio operations.

## Standalone Scripts

### standalone-import.ts

Import a website from a URL into Catalyst Studio.

```bash
# New import
npx tsx scripts/standalone-import.ts --url "https://example.com" --email "user@example.com"

# Import with max pages limit
npx tsx scripts/standalone-import.ts --url "https://example.com" --email "user@example.com" --max-pages 50

# Resume a failed import
npx tsx scripts/standalone-import.ts --resume <jobId>

# Re-import specific pages
npx tsx scripts/standalone-import.ts --reimport --website-id "clxxx..." --urls "https://example.com/about,https://example.com/contact"
```

### standalone-export.ts

Export a website to a headless CMS provider using account-specific integration configurations.

```bash
# Basic export using account integration
npx tsx scripts/standalone-export.ts \
  --website-id "clxxx..." \
  --email "user@example.com" \
  --integration "Opti POC"

# Export and publish content
npx tsx scripts/standalone-export.ts \
  --website-id "clxxx..." \
  --email "user@example.com" \
  --integration "Production Contentstack" \
  --publish

# Skip components and folders
npx tsx scripts/standalone-export.ts \
  --website-id "clxxx..." \
  --email "user@example.com" \
  --integration "Staging Kontent" \
  --skip-components --skip-folders

# Verbose logging
npx tsx scripts/standalone-export.ts \
  --website-id "clxxx..." \
  --email "user@example.com" \
  --integration "Dev Strapi" \
  --verbose
```

**Required Arguments:**

| Argument | Description |
|----------|-------------|
| `--website-id <id>` | Website ID to export |
| `--email <email>` | User email for account lookup |
| `--integration <name>` | Integration display name (e.g., "Opti POC", "Production Contentstack") |

**Optional Arguments:**

| Argument | Description |
|----------|-------------|
| `--publish` | Publish content after export (default: Draft) |
| `--skip-components` | Don't export components |
| `--skip-folders` | Don't export folder hierarchy |
| `--verbose` | Enable detailed logging |

**Notes:**
- Uses the same integration configurations stored in the database as the UI
- Integration name must match the display name configured in your account
- Website must belong to the user's account
- If integration is not found, available integrations will be listed

## Utility Scripts

Various utility scripts for development and administration:

- `check-admins.ts` - Check system admin users
- `check-membership.ts` - Check account memberships
- `debug-access.ts` - Debug access permissions
- `fix-pending-invitations.ts` - Fix stuck invitations
- `list-users.ts` - List all users
- `remove-system-admin.ts` - Remove system admin role
- `seed-system-admin.ts` - Seed initial system admin

## Running Scripts

All scripts should be run from the project root using `npx tsx`:

```bash
npx tsx scripts/<script-name>.ts [options]
```

Scripts automatically load environment variables from `.env.local`.
