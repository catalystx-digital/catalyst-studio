import { prisma } from '@/lib/prisma';
import { Redirect } from '@/lib/generated/prisma';
import { ErrorCode, StandardResponse } from '@/lib/services/types';

export interface CreateRedirectInput {
  websiteId: string;
  sourcePath: string;
  targetPath: string;
  redirectType: 301 | 302;
  isActive?: boolean;
  // External redirect fields (PRD: Redirect Support)
  isExternal?: boolean;
  showInNav?: boolean;
  navLabel?: string;
  openInNewTab?: boolean;
  source?: string;
  description?: string;
}

export interface UpdateRedirectInput {
  id: string;
  sourcePath?: string;
  targetPath?: string;
  redirectType?: 301 | 302;
  isActive?: boolean;
  // External redirect fields (PRD: Redirect Support)
  isExternal?: boolean;
  showInNav?: boolean;
  navLabel?: string;
  openInNewTab?: boolean;
  source?: string;
  description?: string;
}

/**
 * Input for creating external redirects during import
 */
export interface CreateExternalRedirectInput {
  websiteId: string;
  sourcePath: string;
  targetUrl: string;
  source?: string;
  description?: string;
  showInNav?: boolean;
  navLabel?: string;
}

export interface RedirectChainResult {
  finalPath: string;
  hops: number;
  chain: string[];
  hasLoop: boolean;
}

export class RedirectService {
  private maxRedirectHops = 3;

  /**
   * Checks if a target is an external URL (full URL with protocol)
   */
  private isExternalUrl(target: string): boolean {
    return /^https?:\/\//i.test(target);
  }

  /**
   * Validates an external URL
   */
  private validateExternalUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'External URLs must use http or https protocol' };
      }
      // Basic validation passed
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid external URL format' };
    }
  }

  /**
   * Validates redirect paths to prevent loops and invalid redirects
   */
  private validateRedirect(sourcePath: string, targetPath: string, isExternal?: boolean): { valid: boolean; error?: string } {
    // Normalize source path
    const normalizedSource = this.normalizePath(sourcePath);

    // For external redirects, validate the URL differently
    if (isExternal || this.isExternalUrl(targetPath)) {
      // Validate external URL
      const urlValidation = this.validateExternalUrl(targetPath);
      if (!urlValidation.valid) {
        return urlValidation;
      }

      // Check source path - allow standard URL path characters per RFC 3986
      // Allows: letters, numbers, hyphen, slash, dot, underscore, tilde, percent (for encoding), comma, semicolon, colon, @, !, $, &, ', (, ), *, +, =
      const pathRegex = /^[a-zA-Z0-9\-\/\._~%:@!$&'()*+,;=]*$/;
      if (!pathRegex.test(normalizedSource)) {
        return { valid: false, error: 'Source path contains invalid characters' };
      }

      // Check source path length
      if (normalizedSource.length > 2000) {
        return { valid: false, error: 'Source path exceeds maximum length of 2000 characters' };
      }

      // Check target URL length
      if (targetPath.length > 2000) {
        return { valid: false, error: 'Target URL exceeds maximum length of 2000 characters' };
      }

      return { valid: true };
    }

    // For internal redirects, use original validation
    const normalizedTarget = this.normalizePath(targetPath);

    // Check for self-redirect
    if (normalizedSource === normalizedTarget) {
      return { valid: false, error: 'Source and target paths cannot be the same' };
    }

    // Check for invalid characters - allow standard URL path characters per RFC 3986
    // Allows: letters, numbers, hyphen, slash, dot, underscore, tilde, percent (for encoding), comma, semicolon, colon, @, !, $, &, ', (, ), *, +, =
    const pathRegex = /^[a-zA-Z0-9\-\/\._~%:@!$&'()*+,;=]*$/;
    if (!pathRegex.test(normalizedSource) || !pathRegex.test(normalizedTarget)) {
      return { valid: false, error: 'Paths contain invalid characters' };
    }

    // Check path length
    if (normalizedSource.length > 2000 || normalizedTarget.length > 2000) {
      return { valid: false, error: 'Path exceeds maximum length of 2000 characters' };
    }

    return { valid: true };
  }

  private normalizePath(path: string): string {
    // Remove query params and hash
    let normalized = path.split('?')[0].split('#')[0];
    
    // Handle root path
    if (normalized === '' || normalized === '/') {
      return '/';
    }

    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    // Remove trailing slash for non-root paths
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Ensure path starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    
    return normalized;
  }

  /**
   * Creates a new redirect
   */
  async createRedirect(input: CreateRedirectInput): Promise<StandardResponse<Redirect>> {
    try {
      // Normalize source path
      const sourcePath = this.normalizePath(input.sourcePath);

      // Determine if this is an external redirect
      const isExternal = input.isExternal ?? this.isExternalUrl(input.targetPath);

      // For external redirects, don't normalize the target (keep full URL)
      // For internal redirects, normalize the path
      const targetPath = isExternal ? input.targetPath : this.normalizePath(input.targetPath);

      // Validate redirect
      const validation = this.validateRedirect(sourcePath, targetPath, isExternal);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: validation.error || 'Invalid redirect',
            details: { sourcePath, targetPath }
          }
        };
      }

      // Check if redirect already exists
      const existing = await prisma.redirect.findUnique({
        where: {
          websiteId_sourcePath: {
            websiteId: input.websiteId,
            sourcePath
          }
        }
      });

      if (existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.CONFLICT,
            message: 'A redirect for this source path already exists',
            details: { existingId: existing.id, sourcePath }
          }
        };
      }

      // Check for potential loops before creating (only for internal redirects)
      if (!isExternal) {
        const loopCheck = await this.checkForPotentialLoop(input.websiteId, sourcePath, targetPath);
        if (loopCheck.hasLoop) {
          return {
            success: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'This redirect would create a loop',
              details: { chain: loopCheck.chain }
            }
          };
        }
      }

      // Create the redirect
      const redirect = await prisma.redirect.create({
        data: {
          websiteId: input.websiteId,
          sourcePath,
          targetPath,
          redirectType: input.redirectType,
          isActive: input.isActive ?? true,
          // External redirect fields
          isExternal,
          showInNav: input.showInNav ?? false,
          navLabel: input.navLabel,
          openInNewTab: input.openInNewTab ?? (isExternal ? true : false),
          source: input.source,
          description: input.description
        }
      });

      return { success: true, data: redirect };
    } catch (error) {
      console.error('Failed to create redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to create redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Updates an existing redirect
   */
  async updateRedirect(input: UpdateRedirectInput): Promise<StandardResponse<Redirect>> {
    try {
      // Get existing redirect
      const existing = await prisma.redirect.findUnique({
        where: { id: input.id }
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'Redirect not found',
            details: { id: input.id }
          }
        };
      }

      // Prepare update data
      const updateData: any = {};

      // Determine if this is/will be an external redirect
      const isExternal = input.isExternal ??
        (input.targetPath ? this.isExternalUrl(input.targetPath) : existing.isExternal);

      if (input.sourcePath !== undefined) {
        updateData.sourcePath = this.normalizePath(input.sourcePath);
      }

      if (input.targetPath !== undefined) {
        // For external redirects, don't normalize the target
        updateData.targetPath = isExternal ? input.targetPath : this.normalizePath(input.targetPath);
      }

      // Validate if paths are being changed
      if (updateData.sourcePath || updateData.targetPath) {
        const sourcePath = updateData.sourcePath || existing.sourcePath;
        const targetPath = updateData.targetPath || existing.targetPath;

        const validation = this.validateRedirect(sourcePath, targetPath, isExternal);
        if (!validation.valid) {
          return {
            success: false,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: validation.error || 'Invalid redirect',
              details: { sourcePath, targetPath }
            }
          };
        }

        // Check for loops if target is being changed (only for internal redirects)
        if (updateData.targetPath && !isExternal) {
          const loopCheck = await this.checkForPotentialLoop(
            existing.websiteId,
            sourcePath,
            targetPath
          );
          if (loopCheck.hasLoop) {
            return {
              success: false,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: 'This redirect would create a loop',
                details: { chain: loopCheck.chain }
              }
            };
          }
        }
      }

      if (input.redirectType !== undefined) {
        updateData.redirectType = input.redirectType;
      }

      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      // External redirect fields
      if (input.isExternal !== undefined) {
        updateData.isExternal = input.isExternal;
      }
      if (input.showInNav !== undefined) {
        updateData.showInNav = input.showInNav;
      }
      if (input.navLabel !== undefined) {
        updateData.navLabel = input.navLabel;
      }
      if (input.openInNewTab !== undefined) {
        updateData.openInNewTab = input.openInNewTab;
      }
      if (input.source !== undefined) {
        updateData.source = input.source;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      // Update the redirect
      const redirect = await prisma.redirect.update({
        where: { id: input.id },
        data: updateData
      });

      return { success: true, data: redirect };
    } catch (error) {
      console.error('Failed to update redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to update redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Gets a single redirect by ID
   */
  async getRedirect(id: string): Promise<StandardResponse<Redirect>> {
    try {
      const redirect = await prisma.redirect.findUnique({
        where: { id }
      });

      if (!redirect) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'Redirect not found'
          }
        };
      }

      return { success: true, data: redirect };
    } catch (error) {
      console.error('Failed to get redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to get redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Deletes a redirect
   */
  async deleteRedirect(id: string): Promise<StandardResponse<void>> {
    try {
      await prisma.redirect.delete({
        where: { id }
      });

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Failed to delete redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to delete redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Resolves a redirect chain
   */
  async resolveRedirectChain(
    websiteId: string, 
    sourcePath: string
  ): Promise<RedirectChainResult> {
    const chain: string[] = [sourcePath];
    let currentPath = sourcePath;
    let hops = 0;
    const visitedPaths = new Set<string>([sourcePath]);

    while (hops < this.maxRedirectHops) {
      const redirect = await prisma.redirect.findFirst({
        where: {
          websiteId,
          sourcePath: currentPath,
          isActive: true
        }
      });

      if (!redirect) {
        // No more redirects
        return {
          finalPath: currentPath,
          hops,
          chain,
          hasLoop: false
        };
      }

      // Check for loop
      if (visitedPaths.has(redirect.targetPath)) {
        console.warn(`Redirect loop detected: ${chain.join(' -> ')} -> ${redirect.targetPath}`);
        return {
          finalPath: currentPath,
          hops,
          chain,
          hasLoop: true
        };
      }

      currentPath = redirect.targetPath;
      chain.push(currentPath);
      visitedPaths.add(currentPath);
      hops++;
    }

    // Max hops reached
    return {
      finalPath: currentPath,
      hops,
      chain,
      hasLoop: false
    };
  }

  /**
   * Checks if creating a redirect would cause a loop
   */
  private async checkForPotentialLoop(
    websiteId: string,
    sourcePath: string,
    targetPath: string
  ): Promise<RedirectChainResult> {
    // Check if target path redirects back to source
    const reverseCheck = await this.resolveRedirectChain(websiteId, targetPath);
    
    if (reverseCheck.chain.includes(sourcePath)) {
      return {
        finalPath: sourcePath,
        hops: reverseCheck.hops + 1,
        chain: [...reverseCheck.chain, sourcePath],
        hasLoop: true
      };
    }

    return {
      finalPath: targetPath,
      hops: 0,
      chain: [sourcePath, targetPath],
      hasLoop: false
    };
  }

  /**
   * Lists redirects for a website
   */
  async listRedirects(
    websiteId: string,
    options?: {
      isActive?: boolean;
      isExternal?: boolean;
      showInNav?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<StandardResponse<Redirect[]>> {
    try {
      const where: any = { websiteId };

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }
      if (options?.isExternal !== undefined) {
        where.isExternal = options.isExternal;
      }
      if (options?.showInNav !== undefined) {
        where.showInNav = options.showInNav;
      }

      const redirects = await prisma.redirect.findMany({
        where,
        take: options?.limit || 100,
        skip: options?.offset || 0,
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: redirects };
    } catch (error) {
      console.error('Failed to list redirects:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to list redirects',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Creates an external redirect during import
   * Convenience method that handles external redirect defaults
   */
  async createExternalRedirect(input: CreateExternalRedirectInput): Promise<StandardResponse<Redirect>> {
    return this.createRedirect({
      websiteId: input.websiteId,
      sourcePath: input.sourcePath,
      targetPath: input.targetUrl,
      redirectType: 301, // Permanent redirect for SEO
      isActive: true,
      isExternal: true,
      showInNav: input.showInNav ?? false,
      navLabel: input.navLabel,
      openInNewTab: true,
      source: input.source ?? 'import',
      description: input.description
    });
  }

  /**
   * Lists external redirects that should appear in navigation
   */
  async listNavigationExternalLinks(websiteId: string): Promise<StandardResponse<Redirect[]>> {
    return this.listRedirects(websiteId, {
      isActive: true,
      isExternal: true,
      showInNav: true
    });
  }

  /**
   * Sync a page-level redirect to the Redirect table.
   * Only affects redirects with source='page-metadata'.
   * This is called when a user sets a redirectUrl via the Property Editor.
   */
  async syncPageRedirect(input: {
    websiteId: string;
    sourcePath: string;
    targetPath: string;
    redirectType: 301 | 302;
    pageTitle?: string;
  }): Promise<StandardResponse<Redirect>> {
    try {
      const normalizedSource = this.normalizePath(input.sourcePath);
      const isExternal = this.isExternalUrl(input.targetPath);
      const normalizedTarget = isExternal
        ? input.targetPath
        : this.normalizePath(input.targetPath);

      // Validate
      const validation = this.validateRedirect(normalizedSource, normalizedTarget, isExternal);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: validation.error || 'Invalid redirect',
            details: { sourcePath: normalizedSource, targetPath: normalizedTarget }
          }
        };
      }

      // Check if manual redirect exists - don't overwrite
      const existingManual = await prisma.redirect.findFirst({
        where: {
          websiteId: input.websiteId,
          sourcePath: normalizedSource,
          source: 'manual'
        }
      });

      if (existingManual) {
        return {
          success: false,
          error: {
            code: ErrorCode.CONFLICT,
            message: 'A manual redirect exists for this path. Page redirect not synced.',
            details: { existingId: existingManual.id, sourcePath: normalizedSource }
          }
        };
      }

      // Upsert page-level redirect
      const redirect = await prisma.redirect.upsert({
        where: {
          websiteId_sourcePath: {
            websiteId: input.websiteId,
            sourcePath: normalizedSource
          }
        },
        create: {
          websiteId: input.websiteId,
          sourcePath: normalizedSource,
          targetPath: normalizedTarget,
          redirectType: input.redirectType,
          isActive: true,
          isExternal,
          source: 'page-metadata',
          description: input.pageTitle
            ? `Auto-synced from page: ${input.pageTitle}`
            : 'Auto-synced from page metadata'
        },
        update: {
          targetPath: normalizedTarget,
          redirectType: input.redirectType,
          isExternal,
          updatedAt: new Date()
        }
      });

      return { success: true, data: redirect };
    } catch (error) {
      console.error('Failed to sync page redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to sync page redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Remove a page-level redirect from the Redirect table.
   * Only removes redirects with source='page-metadata'.
   * This is called when a user clears the redirectUrl via the Property Editor.
   */
  async removePageRedirect(input: {
    websiteId: string;
    sourcePath: string;
  }): Promise<StandardResponse<{ deleted: boolean }>> {
    try {
      const normalizedSource = this.normalizePath(input.sourcePath);

      const result = await prisma.redirect.deleteMany({
        where: {
          websiteId: input.websiteId,
          sourcePath: normalizedSource,
          source: 'page-metadata'
        }
      });

      return {
        success: true,
        data: { deleted: result.count > 0 }
      };
    } catch (error) {
      console.error('Failed to remove page redirect:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to remove page redirect',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Update the source path of a page-level redirect when page path changes.
   * Only affects redirects with source='page-metadata'.
   * This is called when a page's slug or parent changes.
   */
  async updatePageRedirectPath(input: {
    websiteId: string;
    oldSourcePath: string;
    newSourcePath: string;
  }): Promise<StandardResponse<Redirect | null>> {
    try {
      const normalizedOld = this.normalizePath(input.oldSourcePath);
      const normalizedNew = this.normalizePath(input.newSourcePath);

      if (normalizedOld === normalizedNew) {
        return { success: true, data: null };
      }

      const existing = await prisma.redirect.findFirst({
        where: {
          websiteId: input.websiteId,
          sourcePath: normalizedOld,
          source: 'page-metadata'
        }
      });

      if (!existing) {
        return { success: true, data: null };
      }

      const updated = await prisma.redirect.update({
        where: { id: existing.id },
        data: {
          sourcePath: normalizedNew,
          updatedAt: new Date()
        }
      });

      return { success: true, data: updated };
    } catch (error) {
      console.error('Failed to update page redirect path:', error);
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to update page redirect path',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Gets all external redirects for a website (for export/snapshot)
   */
  async getExternalRedirects(websiteId: string): Promise<StandardResponse<Redirect[]>> {
    return this.listRedirects(websiteId, {
      isExternal: true
    });
  }

  /**
   * Gets all redirects for export (both internal and external)
   */
  async getAllRedirectsForExport(websiteId: string): Promise<StandardResponse<Redirect[]>> {
    return this.listRedirects(websiteId, {
      isActive: true,
      limit: 10000 // Higher limit for export
    });
  }

  /**
   * Bulk import redirects
   */
  async bulkImportRedirects(
    websiteId: string,
    redirects: Array<{
      sourcePath: string;
      targetPath: string;
      redirectType: 301 | 302;
    }>
  ): Promise<StandardResponse<{ created: number; failed: number; errors: any[] }>> {
    let created = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const redirect of redirects) {
      const result = await this.createRedirect({
        websiteId,
        ...redirect
      });

      if (result.success) {
        created++;
      } else {
        failed++;
        errors.push({
          sourcePath: redirect.sourcePath,
          error: result.error
        });
      }
    }

    return {
      success: true,
      data: { created, failed, errors }
    };
  }
}

// Singleton instance
export const redirectService = new RedirectService();