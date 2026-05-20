#!/usr/bin/env npx tsx
/**
 * Standalone Greenfield Script - Create websites from PRD or prompt
 *
 * This script generates a new website from scratch using either:
 * - A PRD file (markdown with detailed specifications)
 * - A direct text prompt describing the desired website
 *
 * IMPORTANT: Environment Loading Strategy
 * ----------------------------------------
 * We use dynamic imports (await import()) instead of static imports for all
 * application modules. This is critical because:
 *
 * 1. JavaScript hoists static imports - they execute BEFORE any other code,
 *    even if dotenv.config() appears first in the source file.
 *
 * 2. Many modules (like ai-sdk-provider.ts) read process.env at module load time
 *    and cache the values. If .env.local hasn't loaded yet, they get defaults.
 *
 * 3. Dynamic imports execute at runtime in the order written, so we can
 *    guarantee dotenv loads before any env-dependent modules.
 *
 * This pattern ensures .env.local is the source of truth for all config,
 * matching how Next.js loads environment variables.
 *
 * Usage:
 *   npx tsx scripts/standalone-greenfield.ts --prd "./path/to/prd.md" --email "user@example.com"
 *   npx tsx scripts/standalone-greenfield.ts --prompt "Build me an awesome website" --email "user@example.com"
 */

// =============================================================================
// Step 1: Load environment FIRST (before any application imports)
// These are the ONLY static imports allowed - they have no env dependencies
// =============================================================================
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// =============================================================================
// CLI Argument Parsing (no env dependencies, safe as static code)
// =============================================================================

interface ScriptArgs {
  /** Path to PRD markdown file */
  prdPath?: string;
  /** Direct prompt text */
  prompt?: string;
  /** User email for account lookup */
  email: string;
  /** Optional website name override */
  name?: string;
}

function parseArgs(argv: string[]): ScriptArgs {
  const args: Partial<ScriptArgs> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--prd' && argv[i + 1]) {
      args.prdPath = argv[++i];
    } else if (arg === '--prompt' && argv[i + 1]) {
      args.prompt = argv[++i];
    } else if (arg === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (arg === '--name' && argv[i + 1]) {
      args.name = argv[++i];
    }
  }

  // Validate required arguments
  if (!args.email) {
    console.error('Error: --email is required');
    printUsage();
    process.exit(1);
  }

  if (!args.prdPath && !args.prompt) {
    console.error('Error: Either --prd or --prompt is required');
    printUsage();
    process.exit(1);
  }

  if (args.prdPath && args.prompt) {
    console.error('Error: Cannot use both --prd and --prompt. Choose one.');
    printUsage();
    process.exit(1);
  }

  // Validate PRD file exists
  if (args.prdPath) {
    const resolvedPath = path.resolve(process.cwd(), args.prdPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: PRD file not found: ${resolvedPath}`);
      process.exit(1);
    }
    args.prdPath = resolvedPath;
  }

  return args as ScriptArgs;
}

function printUsage(): void {
  console.error('');
  console.error('Usage:');
  console.error('');
  console.error('  From PRD file:');
  console.error('    npx tsx scripts/standalone-greenfield.ts --prd "./path/to/prd.md" --email "user@example.com"');
  console.error('');
  console.error('  From direct prompt:');
  console.error('    npx tsx scripts/standalone-greenfield.ts --prompt "Build me an awesome website" --email "user@example.com"');
  console.error('');
  console.error('Options:');
  console.error('  --prd <path>       Path to a PRD markdown file (mutually exclusive with --prompt)');
  console.error('  --prompt <text>    Direct text prompt for website generation (mutually exclusive with --prd)');
  console.error('  --email <email>    User email for account lookup (required)');
  console.error('  --name <name>      Website name (optional, derived from PRD/prompt if not provided)');
}

/**
 * Extract website name from PRD content.
 * Priority: explicit name fields > business name > meaningful headers
 */
function extractNameFromPRD(content: string): string | null {
  const lines = content.split('\n').slice(0, 30);

  // First pass: look for explicit name patterns (highest priority)
  for (const line of lines) {
    // Match "**Name**: X" or "Name: X" (markdown bold or plain)
    const nameMatch = line.match(/^\*?\*?(?:name|business\s*name|project\s*name|website\s*name)\*?\*?:\s*(.+)/i);
    if (nameMatch) {
      return nameMatch[1].trim();
    }

    // Match "Project: X" or "Website: X"
    const projectMatch = line.match(/^(?:project|website|site|business):\s*(.+)/i);
    if (projectMatch) {
      return projectMatch[1].trim();
    }
  }

  // Second pass: look for meaningful headers (skip generic ones)
  for (const line of lines) {
    const headerMatch = line.match(/^#+\s+(.+)/);
    if (headerMatch) {
      const title = headerMatch[1].trim();
      const lower = title.toLowerCase();
      // Skip generic headers
      if (!lower.includes('prd') &&
          !lower.includes('requirements') &&
          !lower.includes('overview') &&
          !lower.includes('document') &&
          !lower.includes('sitemap') &&
          !lower.includes('specification') &&
          !lower.includes('business overview')) {
        return title;
      }
    }
  }

  return null;
}

/**
 * Extract a website name from a prompt.
 */
function extractNameFromPrompt(prompt: string): string {
  const businessTypes = [
    'coffee shop', 'restaurant', 'bakery', 'cafe', 'pizzeria',
    'law firm', 'dental', 'medical', 'clinic', 'hospital',
    'gym', 'fitness', 'yoga', 'spa', 'salon',
    'agency', 'consulting', 'studio', 'company',
    'store', 'shop', 'boutique', 'market'
  ];

  const lowerPrompt = prompt.toLowerCase();
  for (const type of businessTypes) {
    if (lowerPrompt.includes(type)) {
      return type.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Website';
    }
  }

  // Fallback: use first few words
  const words = prompt.split(/\s+/).slice(0, 4).join(' ');
  return words.length > 30 ? words.slice(0, 30) + '...' : words;
}

// =============================================================================
// Step 2: Main function with dynamic imports
// All application modules are imported HERE, after dotenv.config() has run
// =============================================================================

async function main(args: ScriptArgs) {
  // Dynamic imports - these execute NOW, after dotenv.config() has run
  // This guarantees all env-dependent modules see the correct values
  const { PrismaClient } = await import('../lib/generated/prisma');
  const { GreenfieldBootstrapper } = await import('../lib/studio/ai/greenfield-bootstrapper');

  console.log('='.repeat(60));
  console.log('[Standalone Greenfield] Starting...');
  console.log('='.repeat(60));

  // Get the prompt content
  let promptContent: string;
  let sourceName: string;

  if (args.prdPath) {
    promptContent = fs.readFileSync(args.prdPath, 'utf-8');
    sourceName = path.basename(args.prdPath);
    console.log(`  Source: PRD file (${sourceName})`);
    console.log(`  PRD length: ${promptContent.length} characters`);
  } else {
    promptContent = args.prompt!;
    sourceName = 'direct prompt';
    console.log(`  Source: Direct prompt`);
    console.log(`  Prompt: "${promptContent.slice(0, 100)}${promptContent.length > 100 ? '...' : ''}"`);
  }

  console.log(`  Email: ${args.email}`);

  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('\n[Error] OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  // Log which model is being used (helps verify env loaded correctly)
  console.log(`  Model: ${process.env.OPENROUTER_MODEL || '(using defaults)'}`);
  if (process.env.OPENROUTER_BASE_URL) {
    console.log(`  Base URL: ${process.env.OPENROUTER_BASE_URL}`);
  }

  // Create dedicated Prisma client (NOT shared with web app)
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    // 1. Find account via user email
    console.log('\n[Step 1/4] Finding account for user...');
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
      console.error(`  Error: No user found with email ${args.email} or user has no account`);
      process.exit(1);
    }

    const account = user.memberships[0].account;
    console.log(`  Found account: ${account.id} (${account.name})`);

    // 2. Determine website name
    let websiteName: string;
    if (args.name) {
      websiteName = args.name;
    } else if (args.prdPath) {
      websiteName = extractNameFromPRD(promptContent) || `PRD Website ${Date.now()}`;
    } else {
      websiteName = extractNameFromPrompt(promptContent);
    }
    console.log(`  Website name: ${websiteName}`);

    // 3. Create website record
    console.log('\n[Step 2/4] Creating website record...');
    const website = await prisma.website.create({
      data: {
        name: websiteName,
        category: 'greenfield',
        description: `Generated from ${sourceName}`,
        isActive: true,
        accountId: account.id,
        metadata: {
          createdViaAI: true,
          originalPrompt: promptContent,
          source: args.prdPath ? 'prd' : 'prompt',
          createdAt: new Date().toISOString()
        }
      },
    });
    console.log(`  Created website: ${website.id}`);

    // 4. Bootstrap the website using GreenfieldBootstrapper
    console.log('\n[Step 3/4] Bootstrapping website with AI...');
    const startTime = Date.now();
    const bootstrapper = new GreenfieldBootstrapper();

    // Build ProcessedPromptSnapshot - same structure used by workflow
    const processedPrompt = {
      websiteName,
      description: promptContent.slice(0, 500),
      category: 'page' as const,
      suggestedFeatures: [] as string[],
      technicalRequirements: [] as string[],
      targetAudience: 'General audience'
    };

    const result = await bootstrapper.bootstrapWebsite({
      websiteId: website.id,
      accountId: account.id,
      originalPrompt: promptContent,
      processedPrompt
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // 5. Show results
    console.log('\n[Step 4/4] Finalizing...');

    // Count created records
    const pageCount = await prisma.websitePage.count({ where: { websiteId: website.id } });
    const componentTypeCount = await prisma.websiteComponentType.count({ where: { websiteId: website.id } });
    const structureCount = await prisma.websiteStructure.count({ where: { websiteId: website.id } });

    // Get page titles for summary (with structure for slug)
    const pages = await prisma.websitePage.findMany({
      where: { websiteId: website.id },
      select: {
        title: true,
        structures: {
          select: { slug: true, fullPath: true },
          take: 1
        }
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('[Complete] Greenfield website created!');
    console.log('='.repeat(60));
    console.log(`  Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Website ID: ${website.id}`);
    console.log(`  Website Name: ${websiteName}`);
    console.log(`  Total Time: ${duration}s`);
    console.log('');
    console.log('  Records created:');
    console.log(`    - Pages: ${pageCount}`);
    console.log(`    - Structures: ${structureCount}`);
    console.log(`    - Component Types: ${componentTypeCount}`);

    if (pages.length > 0) {
      console.log('');
      console.log('  Pages:');
      for (const page of pages) {
        const slug = page.structures[0]?.fullPath || page.structures[0]?.slug || 'unknown';
        console.log(`    - ${page.title} (${slug})`);
      }
    }

    if (result.error) {
      console.log('');
      console.log(`  Error: ${result.error}`);
    }

    await prisma.$disconnect();
    console.log('\n[Cleanup] Prisma client disconnected');

    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n[Error] Greenfield generation failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

const args = parseArgs(process.argv.slice(2));
main(args)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
