import type { WebsitePage, WebsiteStructure, Prisma } from '@/lib/generated/prisma';

export interface CreatePageDto {
  // Content fields
  title: string;
  contentTypeId: string;
  content?: Prisma.JsonValue;
  metadata?: Prisma.JsonValue;
  templateKey?: string;
  templateProps?: Prisma.JsonValue;
  
  // Structure fields  
  parentId?: string;
  position?: number;
  slug?: string;  // Auto-generated if not provided
  
  // Publishing
  status?: 'draft' | 'published';
}

export interface UpdatePageDto {
  // Content fields
  title?: string;
  content?: Prisma.JsonValue;
  metadata?: Prisma.JsonValue;
  templateKey?: string;
  templateProps?: Prisma.JsonValue;
  slug?: string;
  
  
  // Publishing
  status?: 'draft' | 'published';
}

export interface MovePageDto {
  newParentId?: string | null;
  position?: number;
}

export interface DeleteOptions {
  cascade?: boolean;           // Delete all descendants
  orphanChildren?: boolean;     // Move children to parent
  deleteContent?: boolean;      // Delete ContentItem (default: true)
}

export interface PageResult {
  websitePage: WebsitePage;
  websiteStructure: WebsiteStructure;
  fullPath: string;
  breadcrumbs?: Array<{
    id: string;
    title: string;
    slug: string;
  }>;
}

export interface IPageOrchestrator {
  createPage(dto: CreatePageDto, websiteId: string): Promise<PageResult>;
  updatePage(id: string, dto: UpdatePageDto): Promise<PageResult>;
  deletePage(id: string, options?: DeleteOptions): Promise<void>;
  movePage(id: string, dto: MovePageDto): Promise<PageResult>;
  getPage(id: string): Promise<PageResult | null>;
  resolveUrl(path: string, websiteId: string): Promise<PageResult | null>;
}


