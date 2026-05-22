import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { resolveUniversalMediaService } from '@/lib/services/export/helpers/media-service-loader';
import { WebsiteService } from '@/lib/services/website-service';

type MediaCatalogItem = {
  id: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  altText: string | null;
  signedUrl: string | null;
  publicUrl: string | null;
  originalUrl: string | null;
};

const getWebsiteContextInputSchema = z.object({
  websiteId: z.string().describe('The ID of the website to retrieve context for'),
});

type GetWebsiteContextInput = z.infer<typeof getWebsiteContextInputSchema>;

const fetchMediaCatalog = async (websiteId: string): Promise<MediaCatalogItem[]> => {
  try {
    const mediaIds = await prisma.websiteMedia.findMany({
      where: { websiteId },
      select: { id: true },
      take: 250
    });

    if (mediaIds.length === 0) {
      return [];
    }

    const mediaService = await resolveUniversalMediaService();
    if (!mediaService) {
      return [];
    }

    const assets = await mediaService.getAssetsForWebsiteByIds(
      websiteId,
      new Set(mediaIds.map(row => row.id))
    );

    return Array.from(assets.values()).map(asset => ({
      id: asset.id,
      mimeType: asset.mimeType ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      duration: asset.duration ?? null,
      altText: asset.altText ?? null,
      signedUrl: asset.signedUrl ?? asset.publicUrl ?? null,
      publicUrl: asset.publicUrl ?? null,
      originalUrl: asset.originalUrl ?? null
    }));
  } catch (error) {
    console.warn('get-website-context media catalog load failed', error);
    return [];
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getWebsiteContext = (tool as any)({
  description: 'Retrieves current website metadata and business requirements',
  inputSchema: getWebsiteContextInputSchema,
  execute: async ({ websiteId }: GetWebsiteContextInput) => {
    const startTime = Date.now();
    
    try {
      // Use lazy initialization pattern from Story 5.1
      const websiteService = new WebsiteService();
      
      // Retrieve website metadata
      const website = await websiteService.getWebsite(websiteId);
      
      if (!website) {
        return {
          success: false,
          error: `Website with ID ${websiteId} not found`,
        };
      }

      // Extract business requirements from metadata
      const rawMetadata = website.metadata;
      let metadata: Record<string, any> = {};
      if (rawMetadata) {
        try {
          metadata = typeof rawMetadata === "string" ? JSON.parse(rawMetadata) : rawMetadata;
        } catch (metadataError) {
          console.warn('get-website-context metadata parse failed', metadataError);
          metadata = {};
        }
      }
      const businessRequirements = {
        category: website.category || 'general',
        contentTypes: metadata.contentTypes || [],
        requiredFields: metadata.requiredFields || {},
        validationRules: metadata.validationRules || {},
        seoRequirements: metadata.seoRequirements || {},
        customRules: metadata.customRules || [],
      };

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Log performance for monitoring
      if (executionTime > 2000) {
        console.warn(`get-website-context took ${executionTime}ms (exceeded 2s limit)`);
      } else {
        console.log(`get-website-context completed in ${executionTime}ms`);
      }

      const mediaCatalog = await fetchMediaCatalog(websiteId);

      return {
        success: true,
        data: {
          website: {
            id: website.id,
            name: website.name,
            category: website.category,
            description: website.description,
            isActive: website.isActive,
            createdAt: website.createdAt,
            updatedAt: website.updatedAt,
          },
          businessRequirements,
          websiteMetadata: {
            ...metadata,
          },
          mediaCatalog,
          executionTime: `${executionTime}ms`,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('Error in get-website-context:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: `${executionTime}ms`,
      };
    }
  },
});
