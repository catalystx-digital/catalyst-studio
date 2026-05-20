#!/usr/bin/env npx tsx
/**
 * Standalone Export Script
 *
 * Exports a website to a headless CMS provider using the same logic
 * as the UI deployment flow.
 *
 * IMPORTANT: Environment Loading Strategy
 * ----------------------------------------
 * We use dynamic imports (await import()) instead of static imports for all
 * application modules. This is critical because:
 *
 * 1. JavaScript hoists static imports - they execute BEFORE any other code,
 *    even if dotenv.config() appears first in the source file.
 *
 * 2. Many modules (like provider config) read process.env at module load time
 *    and cache the values. If .env.local hasn't loaded yet, they get defaults.
 *
 * 3. Dynamic imports execute at runtime in the order written, so we can
 *    guarantee dotenv loads before any env-dependent modules.
 *
 * Usage:
 *   npx tsx scripts/standalone-export.ts --website-id "clxxx..." --email "user@example.com" --integration "Opti POC"
 *   npx tsx scripts/standalone-export.ts --website-id "clxxx..." --email "user@example.com" --integration "Production Contentstack" --publish
 */

// =============================================================================
// Step 1: Load environment FIRST (before any application imports)
// These are the ONLY static imports allowed - they have no env dependencies
// =============================================================================
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// =============================================================================
// CLI Argument Parsing (no env dependencies, safe as static code)
// =============================================================================

interface ScriptArgs {
  websiteId: string;
  email: string;
  integration: string;
  publish: boolean;
  skipComponents: boolean;
  skipFolders: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): ScriptArgs {
  const args: Partial<ScriptArgs> = {
    publish: false,
    skipComponents: false,
    skipFolders: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--website-id' && argv[i + 1]) {
      args.websiteId = argv[++i];
    } else if (arg === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (arg === '--integration' && argv[i + 1]) {
      args.integration = argv[++i];
    } else if (arg === '--publish') {
      args.publish = true;
    } else if (arg === '--skip-components') {
      args.skipComponents = true;
    } else if (arg === '--skip-folders') {
      args.skipFolders = true;
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!args.websiteId) {
    console.error('Error: --website-id is required');
    printUsage();
    process.exit(1);
  }

  if (!args.email) {
    console.error('Error: --email is required');
    printUsage();
    process.exit(1);
  }

  if (!args.integration) {
    console.error('Error: --integration is required');
    printUsage();
    process.exit(1);
  }

  return args as ScriptArgs;
}

function printUsage(): void {
  console.error('Usage:');
  console.error('  npx tsx scripts/standalone-export.ts --website-id <id> --email <email> --integration <name>');
  console.error('');
  console.error('Required:');
  console.error('  --website-id <id>       Website ID to export');
  console.error('  --email <email>         User email for account lookup');
  console.error('  --integration <name>    Integration display name (e.g., "Opti POC", "Production Contentstack")');
  console.error('');
  console.error('Options:');
  console.error('  --publish               Publish content after export (default: Draft)');
  console.error('  --skip-components       Don\'t export components');
  console.error('  --skip-folders          Don\'t export folder hierarchy');
  console.error('  --verbose               Detailed logging');
  console.error('  --help, -h              Show this help message');
  console.error('');
  console.error('Examples:');
  console.error('  # Export to Optimizely using configured integration');
  console.error('  npx tsx scripts/standalone-export.ts \\');
  console.error('    --website-id "clxxx123" \\');
  console.error('    --email "user@example.com" \\');
  console.error('    --integration "Opti POC"');
  console.error('');
  console.error('  # Export and publish content');
  console.error('  npx tsx scripts/standalone-export.ts \\');
  console.error('    --website-id "clxxx123" \\');
  console.error('    --email "user@example.com" \\');
  console.error('    --integration "Production Contentstack" \\');
  console.error('    --publish');
  console.error('');
  console.error('  # Skip components and folders');
  console.error('  npx tsx scripts/standalone-export.ts \\');
  console.error('    --website-id "clxxx123" \\');
  console.error('    --email "user@example.com" \\');
  console.error('    --integration "Staging Kontent" \\');
  console.error('    --skip-components --skip-folders');
}

// =============================================================================
// Step 2: Main function with dynamic imports
// All application modules are imported HERE, after dotenv has loaded
// =============================================================================

async function main(args: ScriptArgs) {
  // Dynamic imports - these execute NOW, after dotenv.config() has run
  const { PrismaClient, IntegrationStatus } = await import('../lib/generated/prisma');
  const { DeploymentExecutor } = await import('../lib/services/export/deployment-executor');
  const { IntegrationService } = await import('../lib/studio/services/integration-service');
  const { enumToSlug } = await import('../lib/studio/integrations/definitions');
  const { getProviderDisplayName } = await import('../lib/cms-export/config');

  console.log('='.repeat(60));
  console.log('[Standalone Export] Starting...');
  console.log(`  Website ID: ${args.websiteId}`);
  console.log(`  Email: ${args.email}`);
  console.log(`  Integration: ${args.integration}`);
  if (args.publish) console.log('  Publish: yes');
  if (args.skipComponents) console.log('  Skip Components: yes');
  if (args.skipFolders) console.log('  Skip Folders: yes');
  if (args.verbose) console.log('  Verbose: yes');
  console.log('='.repeat(60));

  // Create dedicated Prisma client (NOT shared with web app)
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    // Step 1: Find user by email and get their account
    console.log('\n[Step 1/5] Finding account for user...');
    const user = await prisma.user.findFirst({
      where: { email: args.email },
      include: {
        memberships: {
          include: { account: true },
          take: 1,
        },
      },
    });

    if (!user || !user.memberships[0]?.account) {
      console.error(`[Error] No user found with email ${args.email} or user has no account`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const account = user.memberships[0].account;
    console.log(`  Found account: ${account.id} (${account.name})`);

    // Step 2: Validate website exists and belongs to this account
    console.log('\n[Step 2/5] Validating website...');
    const website = await prisma.website.findUnique({
      where: { id: args.websiteId },
      select: { id: true, name: true, accountId: true },
    });

    if (!website) {
      console.error(`[Error] Website not found: ${args.websiteId}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    if (website.accountId !== account.id) {
      console.error(`[Error] Website does not belong to account "${account.name}"`);
      console.error(`  Website account: ${website.accountId}`);
      console.error(`  User account: ${account.id}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`  Website: ${website.name} (${website.id})`);

    // Step 3: Find integration by display name for this account
    console.log('\n[Step 3/5] Finding integration...');
    const integration = await prisma.accountIntegration.findFirst({
      where: {
        accountId: account.id,
        displayName: args.integration,
      },
    });

    if (!integration) {
      console.error(`[Error] Integration "${args.integration}" not found for account "${account.name}"`);

      // List available integrations to help user
      const availableIntegrations = await prisma.accountIntegration.findMany({
        where: { accountId: account.id },
        select: { displayName: true, provider: true, status: true },
      });

      if (availableIntegrations.length > 0) {
        console.error('\nAvailable integrations for this account:');
        for (const int of availableIntegrations) {
          const status = int.status === IntegrationStatus.enabled ? '✓' : '✗';
          console.error(`  ${status} "${int.displayName}" (${int.provider})`);
        }
      } else {
        console.error('\nNo integrations configured for this account.');
      }

      await prisma.$disconnect();
      process.exit(1);
    }

    if (integration.status !== IntegrationStatus.enabled) {
      console.error(`[Error] Integration "${args.integration}" is disabled`);
      await prisma.$disconnect();
      process.exit(1);
    }

    const providerSlug = enumToSlug(integration.provider);
    console.log(`  Integration: ${integration.displayName}`);
    console.log(`  Provider: ${getProviderDisplayName(providerSlug)}`);

    // Step 4: Resolve integration config (decrypts secrets)
    console.log('\n[Step 4/5] Resolving integration configuration...');
    const integrationService = new IntegrationService(prisma);

    let resolvedConfig;
    try {
      resolvedConfig = await integrationService.resolveForDeployment(account.id, integration.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resolve integration';
      console.error(`[Error] ${errorMessage}`);
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('  Configuration resolved successfully');

    // Step 5: Execute deployment
    console.log('\n[Step 5/5] Executing export...');
    const executor = new DeploymentExecutor();
    const startTime = Date.now();

    const result = await executor.execute(
      {
        websiteId: args.websiteId,
        providerId: providerSlug,
        providerConfig: resolvedConfig.providerConfig,
        options: {
          includeComponents: !args.skipComponents,
          includeFolders: !args.skipFolders,
          includeContentItems: true,
          publish: args.publish,
        },
      },
      {
        onProgress: async (progress) => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const icon =
            progress.level === 'error'
              ? '\u2717'
              : progress.level === 'warning'
                ? '\u26A0'
                : '\u2192';
          console.log(`  [${elapsed}s] ${progress.progress.toString().padStart(3)}% ${icon} ${progress.message}`);

          if (args.verbose && progress.itemsProcessed !== undefined) {
            console.log(`           Items: ${progress.itemsProcessed}/${progress.totalItems || '?'}`);
          }
        },
      }
    );

    // Print results
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('[Complete] Export finished successfully!');
    } else {
      console.log('[Failed] Export failed');
      console.log(`  Error: ${result.error}`);
    }
    console.log('='.repeat(60));

    // Print statistics
    console.log('\n[Statistics]');
    console.log(`  Content Types: ${result.statistics.contentTypes}`);
    console.log(`  Content Items: ${result.statistics.contentItems}`);
    console.log(`  Components: ${result.statistics.components}`);
    console.log(`  Folders: ${result.statistics.folders}`);
    console.log(`  Created: ${result.statistics.created}`);
    console.log(`  Updated: ${result.statistics.updated}`);
    console.log(`  Skipped: ${result.statistics.skipped}`);
    console.log(`  Errors: ${result.statistics.errors}`);
    console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

    if (result.errorDetails && result.errorDetails.length > 0) {
      console.log('\n[Error Details]');
      const maxErrors = 10;
      for (const detail of result.errorDetails.slice(0, maxErrors)) {
        console.log(`  \u2717 [${detail.id}] ${detail.message}`);
      }
      if (result.errorDetails.length > maxErrors) {
        console.log(`  ... and ${result.errorDetails.length - maxErrors} more errors`);
      }
    }

    await prisma.$disconnect();
    console.log('\n[Cleanup] Prisma client disconnected');

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n[Fatal Error]', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

const args = parseArgs(process.argv.slice(2));
main(args);
