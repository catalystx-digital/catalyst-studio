export interface WebsiteMetadata {
  id: string;
  name: string;
  icon?: string;
  createdAt: Date;
  lastModified: Date;
  storageQuota: number;
  category?: string;
  description?: string;
}

export interface GlobalSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  defaultQuota?: number;
}

export interface WebsiteConfig {
  id: string;
  settings?: Record<string, unknown>;
  theme?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Component {
  id: string;
  name: string;
  type: string;
  props: Record<string, unknown>;
  children?: Component[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  structure: Record<string, unknown>;
  variables: string[];
}

export interface ContentData {
  pages?: Page[];
  components?: Component[];
  templates?: Template[];
}

export interface AssetReferences {
  images?: string[];
  videos?: string[];
  documents?: string[];
}

export interface BrandIdentity {
  name: string;
  tagline?: string;
  mission?: string;
  vision?: string;
  values?: string[];
  personality?: string[];
}

export interface VisualIdentity {
  colors?: {
    primary: string;
    secondary?: string;
    accent?: string;
    [key: string]: string | undefined;
  };
  typography?: {
    heading: string;
    body: string;
    [key: string]: string;
  };
  logoUrl?: string;
}

export interface ContentStrategy {
  tone?: string;
  targetAudience?: string;
  keywords?: string[];
  topics?: string[];
}

export interface AIHistoryEntry {
  id: string;
  timestamp: Date;
  prompt: string;
  response: string;
  context?: Record<string, unknown>;
}

export interface AIContext {
  brandIdentity?: BrandIdentity;
  visualIdentity?: VisualIdentity;
  contentStrategy?: ContentStrategy;
  history?: AIHistoryEntry[];
}

export interface WebsiteData {
  config: WebsiteConfig;
  content: ContentData;
  assets: AssetReferences;
  aiContext: AIContext;
}

export interface StorageArchitecture {
  catalyst_global: {
    version: string;
    websites: WebsiteMetadata[];
    settings: GlobalSettings;
  };
  [key: `website_${string}_config`]: WebsiteConfig;
  [key: `website_${string}_content`]: ContentData;
  [key: `website_${string}_assets`]: AssetReferences;
  [key: `website_${string}_ai_context`]: AIContext;
}

export interface StorageQuota {
  usage: number;
  quota: number;
  percentUsed: number;
}

export interface QuotaStatus {
  total: StorageQuota;
  byWebsite: Map<string, number>;
  warning: boolean;
  critical: boolean;
}

export interface CleanupSuggestions {
  websiteId: string;
  suggestions: string[];
  potentialSavings: number;
}