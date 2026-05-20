/**
 * AI Tools Index
 * 
 * Exports all available AI tools for the chat API.
 * Tools follow the Vercel AI SDK pattern.
 */

import { tool } from 'ai';
import { z } from 'zod';

// Import website management tools from Story 5.2
import { 
  getWebsiteContext,
  updateBusinessRequirements,
  validateContent 
} from './website/index';

// Import content type management tools from Story 5.3
import {
  listContentTypes,
  getContentType,
  createContentType,
  updateContentType
} from './content-types/index';

// Import content item management tools from Story 5.4
import {
  listContentItems,
  // updateContentItem  // TEMPORARILY DISABLED for BUG-006 fix - forces AI to use updateComponentProperty
} from './content-items/index';

// Import page management tools (Story 8.5 - Fixed Implementation)
// These tools ensure atomic operations on both ContentItem and SiteStructure
import {
  createPage,
  deletePage,
  populatePageContent
} from './pages/index';

// Import image tools for fetching stock images
import {
  searchImages
} from './images/index';

// Import component management tools (BUG-006 fix)
import {
  updateComponentProperty,
  findAndUpdateComponent,
  deleteComponent,
  batchUpdateComponents,
  batchAddComponents,
  batchDeleteComponents
} from './components/index';

// Import progress tracking tools (TKT-007)
import {
  writeProgress,
  readProgress
} from './progress/index';

// Import design system tools (TKT-040)
import {
  importDesignSystem
} from './design-system/index';

// Import site structure tools (TKT-071)
import {
  createSiteStructure
} from './site-structure/index';

/**
 * Test tool for verifying tool execution
 * This is a simple tool that echoes back input for testing
 */
export const echoTool = tool({
  description: 'A test tool that echoes back the input message',
  inputSchema: z.object({
    message: z.string().describe('The message to echo back')
  }),
  execute: async ({ message }) => {
    return {
      success: true,
      data: {
        echo: message,
        timestamp: new Date().toISOString()
      }
    };
  }
});

/**
 * Export all tools as an array for test compatibility
 */
export const allTools = [
  // Website management tools (Story 5.2)
  getWebsiteContext,
  updateBusinessRequirements,
  validateContent,
  // Content type management tools (Story 5.3)
  listContentTypes,
  getContentType,
  createContentType,
  updateContentType,
  // Page management tools (Story 8.5)
  createPage,
  deletePage,
  populatePageContent,
  // Content item management tools (Story 5.4)
  listContentItems,
  // updateContentItem,  // TEMPORARILY DISABLED for BUG-006 fix - use updateComponentProperty for component updates
  // Image tools
  searchImages,
  // Component management tools (BUG-006 fix)
  updateComponentProperty,
  findAndUpdateComponent,
  deleteComponent,
  batchUpdateComponents,
  batchAddComponents,
  batchDeleteComponents,
  // Progress tracking tools (TKT-007)
  writeProgress,
  readProgress,
  // Design system tools (TKT-040)
  importDesignSystem,
  // Site structure tools (TKT-071)
  createSiteStructure,
  // Test tool
  echoTool
];

/**
 * Export tools as an object for named access
 */
export const tools = {
  // Website management tools (Story 5.2)
  getWebsiteContext,
  updateBusinessRequirements,
  validateContent,
  // Content type management tools (Story 5.3)
  listContentTypes,
  getContentType,
  createContentType,
  updateContentType,
  // Page management tools (Story 8.5)
  createPage,
  deletePage,
  populatePageContent,
  // Content item management tools (Story 5.4)
  listContentItems,
  // updateContentItem,  // TEMPORARILY DISABLED for BUG-006 fix - use updateComponentProperty for component updates
  // Image tools
  searchImages,
  // Component management tools (BUG-006 fix)
  updateComponentProperty,
  findAndUpdateComponent,
  deleteComponent,
  batchUpdateComponents,
  batchAddComponents,
  batchDeleteComponents,
  // Progress tracking tools (TKT-007)
  writeProgress,
  readProgress,
  // Design system tools (TKT-040)
  importDesignSystem,
  // Site structure tools (TKT-071)
  createSiteStructure,
  // Test tool
  echoTool
};

/**
 * Export tool names for reference
 */
export const toolNames = Object.keys(tools);