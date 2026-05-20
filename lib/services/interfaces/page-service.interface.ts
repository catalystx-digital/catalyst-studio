import { WebsitePage, WebsiteStructure, Prisma } from '@/lib/generated/prisma';

/**
 * Data transfer object for creating a new page
 * @interface CreatePageDto
 */
export interface CreatePageDto {
  websiteId: string;
  type: 'page' | 'folder';
  title: string;
  content?: any;
  slug?: string;
  parentId?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  ogImage?: string;
}

/**
 * Data transfer object for updating an existing page
 * @interface UpdatePageDto
 */
export interface UpdatePageDto {
  title?: string;
  content?: any;
  slug?: string;
  parentId?: string;
  status?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  ogImage?: string;
  isPublished?: boolean;
  publishedAt?: Date | null;
}

/**
 * Extended page interface that includes structure information
 * @interface PageWithStructure
 * @extends {WebsitePage}
 */
export interface PageWithStructure extends WebsitePage {
  structure?: WebsiteStructure | null;
}

/**
 * Service interface for WebsitePage operations
 * Handles all page-related business logic including creation, updates, hierarchy management
 * @interface IPageService
 */
export interface IPageService {
  /**
   * Create a new page with its structure entry
   * @param {CreatePageDto} data - Page creation data
   * @returns {Promise<PageWithStructure>} Created page with structure information
   * @throws {Error} If parent page doesn't exist or slug conflicts
   */
  createPage(data: CreatePageDto): Promise<PageWithStructure>;

  /**
   * Get a page by ID
   * @param {string} id - Page ID
   * @returns {Promise<WebsitePage | null>} Page if found, null otherwise
   */
  getPage(id: string): Promise<WebsitePage | null>;

  /**
   * Get a page with its structure information
   * @param {string} id - Page ID
   * @returns {Promise<PageWithStructure | null>} Page with structure if found
   */
  getPageWithStructure(id: string): Promise<PageWithStructure | null>;

  /**
   * Update a page and its structure
   * @param {string} id - Page ID to update
   * @param {UpdatePageDto} data - Update data
   * @returns {Promise<PageWithStructure>} Updated page with structure
   * @throws {Error} If page not found or slug conflicts
   */
  updatePage(id: string, data: UpdatePageDto): Promise<PageWithStructure>;

  /**
   * Delete a page and its associated structure
   * @param {string} id - Page ID to delete
   * @returns {Promise<void>}
   * @throws {Error} If page has children or is referenced
   */
  deletePage(id: string): Promise<void>;

  /**
   * Get all pages for a website
   * @param {string} websiteId - Website ID
   * @returns {Promise<WebsitePage[]>} Array of pages
   */
  getPagesByWebsite(websiteId: string): Promise<WebsitePage[]>;

  /**
   * Get pages with hierarchy information
   * @param {string} websiteId - Website ID
   * @returns {Promise<PageWithStructure[]>} Pages with structure data
   */
  getPagesHierarchy(websiteId: string): Promise<PageWithStructure[]>;

  /**
   * Move a page to a different parent
   * @param {string} pageId - Page ID to move
   * @param {string | null} newParentId - New parent ID or null for root
   * @returns {Promise<PageWithStructure>} Moved page with updated structure
   * @throws {Error} If would create circular reference
   */
  movePage(pageId: string, newParentId: string | null): Promise<PageWithStructure>;

  /**
   * Duplicate a page
   * @param {string} pageId - Page ID to duplicate
   * @param {string} [newTitle] - Optional new title
   * @returns {Promise<PageWithStructure>} Duplicated page
   */
  duplicatePage(pageId: string, newTitle?: string): Promise<PageWithStructure>;

  /**
   * Publish/unpublish a page
   * @param {string} pageId - Page ID
   * @param {boolean} isPublished - Publication status
   * @returns {Promise<WebsitePage>} Updated page
   */
  setPagePublished(pageId: string, isPublished: boolean): Promise<WebsitePage>;

  /**
   * Get page by slug and website
   * @param {string} websiteId - Website ID
   * @param {string} slug - Page slug
   * @returns {Promise<PageWithStructure | null>} Page if found
   */
  getPageBySlug(websiteId: string, slug: string): Promise<PageWithStructure | null>;
}