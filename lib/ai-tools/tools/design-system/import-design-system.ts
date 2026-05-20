/**
 * AI Tool for Design System Import
 *
 * Allows LLM to import design systems (colors, typography, styling)
 * from external URLs and store them as design concepts.
 *
 * Uses the shared importDesignSystemFromUrl function for actual processing.
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  importDesignSystemFromUrl,
  ImportDesignSystemError,
} from '@/lib/studio/design-system/import-design-system';

/**
 * Import a design system from a URL and create a design concept
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const importDesignSystem = (tool as any)({
  description: `Import a design system (colors, typography, styling) from an external URL and store it as a new design concept for a website.

Use this tool when the user wants to:
- Extract design tokens from another website
- Import colors and styles from a reference URL
- Create a design concept based on an existing website's look
- Apply styling from a source URL to their project

The tool will:
1. Probe the URL for design system information (colors, typography, spacing)
2. Process and normalize the extracted data
3. Create a design concept with the extracted tokens
4. Return a summary of what was extracted`,
  inputSchema: z.object({
    url: z.string().url().describe('URL to extract design system from (must be a valid http/https URL)'),
    websiteId: z.string().describe('Website ID to store the design system for'),
    name: z.string().optional().describe('Optional name for this design concept (e.g., "Apple-inspired", "Minimalist"). Auto-generated if not provided.')
  }),
  execute: async ({ url, websiteId, name }: { url: string; websiteId: string; name?: string }) => {
    const startTime = Date.now();

    try {
      const result = await importDesignSystemFromUrl({
        url,
        websiteId,
        conceptName: name,
      });

      // Extract summary information for LLM response
      const confidence = result.metrics?.confidence ?? result.shadcnTokens?.extraction?.confidence ?? null;
      const summary: Record<string, unknown> = {
        confidence,
        storageFormat: result.storageFormat,
      };

      // Extract color information from shadcnTokens (new format)
      // Note: CSS variables are stored with -- prefix (e.g., '--primary', not 'primary')
      if (result.shadcnTokens?.variables) {
        const vars = result.shadcnTokens.variables;
        if (vars['--primary']) summary.primaryColor = vars['--primary'];
        if (vars['--secondary']) summary.secondaryColor = vars['--secondary'];
        if (vars['--accent']) summary.accentColor = vars['--accent'];
        if (vars['--background']) summary.backgroundColor = vars['--background'];
        if (vars['--foreground']) summary.foregroundColor = vars['--foreground'];
      }

      // Build warnings array
      const warnings: string[] = [...result.warnings];
      if (confidence !== null && confidence < 0.5) {
        warnings.push('Low confidence extraction - design tokens may be incomplete');
      }
      // Check for --primary (CSS variable format, not plain 'primary')
      if (!result.shadcnTokens?.variables?.['--primary']) {
        warnings.push('No primary color detected');
      }

      return {
        success: true,
        message: `Successfully imported design system from ${new URL(url).hostname}`,
        conceptId: result.conceptId,
        conceptName: result.conceptName,
        summary,
        warnings,
        executionTime: `${Date.now() - startTime}ms`,
      };
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;

      // Handle specific import errors
      if (error instanceof ImportDesignSystemError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
          executionTime,
        };
      }

      // Handle generic errors
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import design system',
        errorCode: 'UNKNOWN',
        executionTime,
      };
    }
  }
});
