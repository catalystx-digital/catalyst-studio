import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';
import { saveManager, SaveStatus, ComponentOperation } from '../components/site-builder/save-manager';
import { transformFromReactFlow } from '../components/site-builder/transforms/from-react-flow';
import { SitemapNode, SitemapEdge, CreateNodeData } from '../components/site-builder/types';
import { ContentTypeCategory } from '@/lib/generated/prisma';
import { UndoManager } from '../components/site-builder/undo-manager';
import { ComponentInstance, ComponentInstanceArray } from '@/lib/studio/types/site-builder/component-instance';
import type { MediaLibraryItem } from '@/lib/studio/media/types';
import type { ContentTypeWithParsedFields, ContentTypeFields, ContentTypeSettings } from '@/lib/services/content-type-service';
import { isHomeLike } from '@/lib/studio/utils/home-page-utils';
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts';
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize';

/**
 * Deep clone nodes/edges to ensure previousNodes doesn't share references with nodes.
 * This is critical for change detection in transformFromReactFlow.
 * BUG-003 FIX: Without deep cloning, Object.assign mutations affect both arrays.
 */
function deepCloneNodes<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items));
}

// Forward declare the store type for circular reference
// eslint-disable-next-line prefer-const
let storeStateUpdater: ((canUndo: boolean, canRedo: boolean) => void) | undefined;
let loadStructureRequestSeq = 0;

function cloneComponentsForSave(components: ComponentInstanceArray): Record<string, any>[] {
  return JSON.parse(JSON.stringify(components));
}

function pageUpdatedAtForSave(node: { data?: Record<string, any> } | undefined): string | undefined {
  const value = node?.data?.updatedAt;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' ? value : undefined;
}

// Create undoManager instance with proper initialization
const undoManager = new UndoManager({
  maxHistorySize: 50,
  onStateChange: (canUndo: boolean, canRedo: boolean) => {
    if (storeStateUpdater) {
      storeStateUpdater(canUndo, canRedo);
    }
  }
});

// Global Component types
interface GlobalComponent {
  id: string;
  componentId: string;
  websiteId: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  usageCount: number;
  lastModified: Date;
  createdBy: string;
}

interface GlobalComponentUsage {
  id: string;
  globalComponentId: string;
  pageId: string;
  position: any;
  overrides?: any;
}

interface ImpactAnalysis {
  affectedPages: Array<{
    id: string;
    title: string;
    path: string;
    status: string;
    isPublished: boolean;
    hasOverrides: boolean;
  }>;
  totalCount: number;
  publishedCount: number;
  severity: 'low' | 'medium' | 'high';
}

export interface PageTypeOption {
  id: string;
  name: string;
  key?: string | null;
  description?: string | null;
  isHome: boolean;
}

type ContentTypeCatalogBucket = {
  label: string;
  items: ContentTypeWithParsedFields[];
};

type ContentTypeCatalog = Record<string, ContentTypeCatalogBucket>;

interface WebsiteComponentTypeRecord {
  id: string;
  websiteId: string;
  type: string;
  category: string;
  defaultConfig?: Record<string, unknown> | null;
  placeholderData?: Record<string, unknown> | null;
  styles?: Record<string, unknown> | null;
  aiMetadata?: Record<string, unknown> | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  version?: string | null;
  isGlobal?: boolean | null;
  confidence?: number | null;
}

type ComponentApiResponse = {
  items?: WebsiteComponentTypeRecord[];
  total?: number;
  page?: number;
  limit?: number;
};

const DEFAULT_CATEGORY_LABEL = 'Uncategorized';
const DEFAULT_CATEGORY_KEY = 'uncategorized';

const EXCLUDED_FIELD_KEYS = new Set(['responsive', 'breakpoints', 'styles', 'variants']);

let cmsRegistryPromise: Promise<void> | null = null;
const ensureCmsRegistryInitialized = async () => {
  if (!cmsRegistryPromise) {
    cmsRegistryPromise = initializeCMSComponents().catch((error) => {
      cmsRegistryPromise = null;
      throw error;
    });
  }
  return cmsRegistryPromise;
};

const normalizeCategory = (category: ContentTypeWithParsedFields['category']) => {
  if (typeof category !== 'string') {
    return { key: DEFAULT_CATEGORY_KEY, label: DEFAULT_CATEGORY_LABEL };
  }
  const trimmed = category.trim();
  if (!trimmed) {
    return { key: DEFAULT_CATEGORY_KEY, label: DEFAULT_CATEGORY_LABEL };
  }
  return { key: trimmed.toLowerCase(), label: trimmed };
};

const groupContentTypesByCategory = (types: ContentTypeWithParsedFields[]): ContentTypeCatalog => {
  return types.reduce<ContentTypeCatalog>((acc, type) => {
    const { key, label } = normalizeCategory(type.category);
    if (!acc[key]) {
      acc[key] = { label, items: [] };
    }
    acc[key].items.push(type);
    return acc;
  }, {});
};

type DerivedField = { id: string; name: string; label?: string; type?: string; detail?: string };

const humanizeSlug = (value: string | null | undefined) => {
  if (!value) return '';
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const beautifyIdentifier = (value: string) => {
  if (!value) return value;
  if (/\s/.test(value)) return value;
  const tokens = value.split(/[\.\-_]/).filter(Boolean);
  if (tokens.length <= 1) {
    return tokens[0] ? tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1) : value;
  }
  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' · ');
};

const describeSampleValue = (sample: unknown): string => {
  if (Array.isArray(sample)) {
    const first = sample.find((item) => item !== null && item !== undefined);
    const inner = first === undefined ? 'unknown' : describeSampleValue(first);
    return `array<${inner}>`;
  }
  if (sample === null) return 'null';
  const type = typeof sample;
  if (type === 'object') {
    const keys = Object.keys(sample as Record<string, unknown>).slice(0, 3);
    return keys.length > 0 ? `object<${keys.join(', ')}>` : 'object';
  }
  if (type === 'string') return 'text';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return type;
};

const summarizeSampleDetail = (sample: unknown): string | null => {
  if (sample === null || sample === undefined) {
    return null;
  }
  if (typeof sample === 'string') {
    const beautified = beautifyIdentifier(sample);
    const trimmed = beautified.length > 50 ? `${beautified.slice(0, 47)}…` : beautified;
    return trimmed;
  }
  if (typeof sample === 'number' || typeof sample === 'boolean') {
    return String(sample);
  }
  if (Array.isArray(sample)) {
    const length = sample.length;
    const first = sample.find((item) => item !== null && item !== undefined);
    if (typeof first === 'string') {
      const beautified = beautifyIdentifier(first);
      const preview = beautified.length > 32 ? `${beautified.slice(0, 29)}…` : beautified;
      return length > 1 ? `${preview} +${length - 1} more` : preview;
    }
    if (typeof first === 'object' && first !== null) {
      const keys = Object.keys(first as Record<string, unknown>)
        .slice(0, 3)
        .map(beautifyIdentifier);
      return keys.length > 0 ? `items with ${keys.join(', ')}` : `${length} items`;
    }
    return length > 0 ? `${length} items` : null;
  }
  if (typeof sample === 'object') {
    const keys = Object.keys(sample as Record<string, unknown>)
      .slice(0, 3)
      .map(beautifyIdentifier);
    return keys.length > 0 ? `keys: ${keys.join(', ')}` : null;
  }
  return null;
};

const appendField = (
  fields: DerivedField[],
  seen: Set<string>,
  name: string,
  sample: unknown,
  options: { prefix?: string } = {}
) => {
  const normalized = name.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  fields.push({
    id: `${options.prefix ?? 'field'}-${normalized}`,
    name: normalized,
    type: describeSampleValue(sample),
    detail: summarizeSampleDetail(sample) ?? undefined,
  });
};

const collectFieldsFromObject = (
  payload: Record<string, unknown>,
  fields: DerivedField[],
  seen: Set<string>,
  depth: number,
  prefix?: string
) => {
  const nextDepth = depth + 1;
  for (const [key, value] of Object.entries(payload)) {
    if (EXCLUDED_FIELD_KEYS.has(key.toLowerCase())) {
      continue;
    }
    const fieldName = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      appendField(fields, seen, fieldName, value);
      const firstItem = value.find((item) => item && typeof item === 'object');
      if (firstItem && nextDepth <= 1) {
        collectFieldsFromObject(firstItem as Record<string, unknown>, fields, seen, nextDepth, fieldName);
      }
    } else if (value && typeof value === 'object') {
      if (nextDepth <= 1 && Object.keys(value).length <= 8) {
        collectFieldsFromObject(value as Record<string, unknown>, fields, seen, nextDepth, fieldName);
      } else {
        appendField(fields, seen, fieldName, value);
      }
    } else {
      appendField(fields, seen, fieldName, value);
    }
  }
};

const extractComponentFields = (component: WebsiteComponentTypeRecord): DerivedField[] => {
  const fields: DerivedField[] = [];
  const seen = new Set<string>();

  // Schema-first: propsMeta is derived from schema or legacy propsMeta
  const contract = getComponentContractByCanonicalType(component.type);
  if (contract?.propsMeta) {
    Object.entries(contract.propsMeta).forEach(([key, meta]) => {
      const normalizedKey = key.trim();
      if (!normalizedKey || seen.has(normalizedKey)) {
        return;
      }
      seen.add(normalizedKey);
      fields.push({
        id: `contract-${component.id}-${normalizedKey}`,
        name: normalizedKey,
        label: beautifyIdentifier(normalizedKey),
        type: meta.type,
        detail: meta.description ?? (meta.required ? 'Required field' : 'Optional field'),
      });
    });
  }

  if (fields.length > 0) {
    return fields.slice(0, 24);
  }

  if (component.placeholderData && typeof component.placeholderData === 'object') {
    collectFieldsFromObject(component.placeholderData as Record<string, unknown>, fields, seen, 0);
  }

  if (component.defaultConfig && typeof component.defaultConfig === 'object') {
    const configEntries = { ...(component.defaultConfig as Record<string, unknown>) };
    delete configEntries.name;
    delete configEntries.description;
    collectFieldsFromObject(configEntries, fields, seen, 0);
  }

  if (fields.length === 0 && component.aiMetadata && typeof component.aiMetadata === 'object') {
    const metadata = component.aiMetadata as Record<string, unknown>;
    if (Array.isArray(metadata?.tags)) {
      appendField(fields, seen, 'tags', metadata.tags);
    }
  }

  if (fields.length === 0) {
    appendField(fields, seen, 'type', component.type);
  }

  return fields.slice(0, 12);
};

const createDefaultFolderType = (websiteId: string): ContentTypeWithParsedFields => {
  const timestamp = new Date();
  const fields: DerivedField[] = [
    { id: 'folder-title', name: 'title', label: 'Folder Title', type: 'text' },
    { id: 'folder-slug', name: 'slug', label: 'Slug', type: 'text' },
    { id: 'folder-components', name: 'components', label: 'Components', type: 'content[]' }
  ];

  const folderType: ContentTypeWithParsedFields = {
    id: `folder-template-${websiteId}`,
    websiteId,
    name: 'Navigation Folder',
    category: 'folder',
    fields: { fields } as ContentTypeFields,
    settings: {
      description: 'Structural folder used to organize sitemap groups.',
      source: 'system-default'
    } as ContentTypeSettings,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  (folderType as unknown as Record<string, unknown>).key = 'navigation-folder';
  return folderType;
};

const mapComponentTypesToContentTypes = (components: WebsiteComponentTypeRecord[]): ContentTypeWithParsedFields[] => {
  return components.map((component) => {
    const displayName =
      (component.defaultConfig && typeof component.defaultConfig === 'object' && typeof (component.defaultConfig as Record<string, unknown>).name === 'string'
        ? ((component.defaultConfig as Record<string, unknown>).name as string)
        : null) || humanizeSlug(component.type) || 'Component';

    const description =
      (component.defaultConfig && typeof component.defaultConfig === 'object' && typeof (component.defaultConfig as Record<string, unknown>).description === 'string'
        ? ((component.defaultConfig as Record<string, unknown>).description as string)
        : null) || `Component template ${displayName}`;

    const fields = extractComponentFields(component);

    const createdAt = component.createdAt ? new Date(component.createdAt) : new Date();
    const updatedAt = component.updatedAt ? new Date(component.updatedAt) : createdAt;

    const mapped: ContentTypeWithParsedFields = {
      id: component.id,
      websiteId: component.websiteId ?? 'component-library',
      name: displayName,
      category: 'component',
      fields: { fields } as ContentTypeFields,
      settings: {
        description,
        componentCategory: component.category,
        source: 'component-type-registry',
      } as ContentTypeSettings,
      createdAt,
      updatedAt,
    };

    (mapped as unknown as Record<string, unknown>).key = component.type;
    return mapped;
  });
};

const fetchAllComponentTypes = async (websiteId: string): Promise<WebsiteComponentTypeRecord[]> => {
  const pageSize = 100;
  let page = 1;
  let total = 0;
  const allItems: WebsiteComponentTypeRecord[] = [];

  while (true) {
    const response = await fetch(
      `/api/studio/site-builder/components?websiteId=${encodeURIComponent(websiteId)}&page=${page}&limit=${pageSize}`
    );
    if (!response.ok) {
      throw new Error('Failed to load component types');
    }
    const payload = (await response.json()) as ComponentApiResponse;
    const items = Array.isArray(payload?.items) ? (payload.items as WebsiteComponentTypeRecord[]) : [];
    allItems.push(...items);
    total = typeof payload?.total === 'number' ? payload.total : allItems.length;
    if (allItems.length >= total || items.length === 0) {
      break;
    }
    page += 1;
    if (page > 20) {
      // Safeguard against endless pagination loops
      break;
    }
  }

  return allItems;
};

const derivePageTypeOptions = (rawTypes: ContentTypeWithParsedFields[]) => {
  const mappedTypes: PageTypeOption[] = rawTypes
    .filter((type) => {
      const category = typeof type.category === 'string' ? type.category.toLowerCase() : '';
      return category === 'page';
    })
    .map((type) => {
      const description = typeof type.settings?.description === 'string'
        ? type.settings.description
        : null;
      const name = type.name && type.name.trim().length > 0 ? type.name : 'Page';
      const key = (type as unknown as Record<string, unknown>).key;
      const normalizedKey = typeof key === 'string' ? key : null;
      const isHome = isHomeLike(normalizedKey) || isHomeLike(name);

      return {
        id: type.id,
        name,
        key: normalizedKey,
        description,
        isHome,
      };
    })
    .filter((type, index, self) => self.findIndex((other) => other.id === type.id) === index);

  const hasRealTypes = mappedTypes.length > 0;

  if (hasRealTypes && !mappedTypes.some((type) => type.isHome)) {
    const candidateIndex = mappedTypes.findIndex((type) => /(landing|main|root)/i.test(type.name));
    const index = candidateIndex >= 0 ? candidateIndex : 0;
    mappedTypes[index] = { ...mappedTypes[index], isHome: true };
  }

  const pageTypes = mappedTypes.sort((a, b) => {
    if (a.isHome && !b.isHome) return -1;
    if (!a.isHome && b.isHome) return 1;
    return a.name.localeCompare(b.name);
  });

  return { pageTypes, hasRealTypes };
};

interface SiteBuilderState {
  // Data
  nodes: SitemapNode[];
  edges: SitemapEdge[];
  websiteId: string | null;
  websiteRevision: number | null;
  pageTypes: PageTypeOption[];
  pageTypesLoaded: boolean;
  pageTypesLoading: boolean;
  pageTypesError: string | null;
  contentTypesAll: ContentTypeWithParsedFields[];
  contentTypeCatalog: ContentTypeCatalog;
  contentTypesLoaded: boolean;
  contentTypesLoading: boolean;
  contentTypesError: string | null;
  contentTypesWebsiteId: string | null;
  componentTypesAll: WebsiteComponentTypeRecord[];
  componentTypesLoaded: boolean;
  componentTypesLoading: boolean;
  componentTypesError: string | null;
  
  // UI State
  selectedNodes: string[];
  selectedComponentId: string | null;
  saveStatus: SaveStatus;
  isLoading: boolean;
  errorState: { message: string; retry?: () => void } | null;
  
  // Undo/Redo state
  canUndo: boolean;
  canRedo: boolean;
  isUndoRedoInProgress: boolean;
  previousNodes: SitemapNode[];
  previousEdges: SitemapEdge[];
  
  // Global Component state
  globalComponents: Map<string, GlobalComponent>;
  globalUsages: Map<string, GlobalComponentUsage[]>;
  isLoadingGlobal: boolean;
  globalError: string | null;
  optimisticGlobalUpdates: Map<string, any>;

  mediaLibrary: {
    items: MediaLibraryItem[];
    isLoading: boolean;
    error: string | null;
    search: string;
    nextCursor: string | null;
    hasMore: boolean;
    lastLoadedWebsiteId: string | null;
  };

  // Viewport sync state
  loadedNodeDetails: Map<string, 'skeleton' | 'minimal' | 'standard' | 'full'>;
  viewportSyncEnabled: boolean;

  // Position index (single source of truth for positions)
  nodePositionIndex: Map<string, { x: number; y: number; width: number; height: number }>;

  // Search state
  searchQuery: string;
  searchResults: Array<{
    structureId: string;
    pageTitle: string | null;
    pageSlug: string;
    fullPath: string;
    position: { x: number; y: number };
    relevanceScore: number;
  }>;
  searchIsOpen: boolean;
  searchIsLoading: boolean;
  // BUG-009 FIX: Store viewport state before search for restoration
  viewportBeforeSearch: { x: number; y: number; zoom: number } | null;

  // Navigation state
  focusedNodeId: string | null;
  navigationHistory: string[];
  isJumping: boolean;

  // Property Panel state
  propertyPanelState: {
    isOpen: boolean;
    selectedComponentId: string | null;
    activeTab: string;
    scrollPosition: number;
  };
  
  // Actions
  loadStructure: (websiteId: string, signal?: AbortSignal) => Promise<void>;
  loadPageTypes: (websiteId: string) => Promise<void>;
  loadContentTypeCatalog: (websiteId: string, options?: { force?: boolean }) => Promise<void>;
  addNode: (parentId: string | null, data: CreateNodeData, options?: { anchorId?: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNodes: (nodeIds: string[]) => void;
  moveNode: (nodeId: string, newParentId: string | null) => void;
  
  // Selection
  setSelectedNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;
  setSelectedComponentId: (componentId: string | null) => void;
  getSelectedComponent: () => ComponentInstance | null;
  
  // React Flow handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  // Save management
  setSaveStatus: (status: SaveStatus) => void;
  setWebsiteRevision: (revision: number | null) => void;
  setError: (error: { message: string; retry?: () => void } | null) => void;
  
  // History management
  captureState: () => void;
  undo: () => void;
  redo: () => void;
  
  // Global Component actions
  toggleGlobalState: (componentId: string, componentData: any) => Promise<void>;
  loadGlobalComponents: (websiteId: string) => Promise<void>;
  propagateGlobalChanges: (globalId: string, properties: any, options?: { skipOverrides?: boolean }) => Promise<void>;
  getImpactAnalysis: (globalId: string) => Promise<ImpactAnalysis>;
  applyOptimisticGlobalUpdate: (componentId: string, update: any) => void;
  rollbackOptimisticGlobalUpdate: (componentId: string) => void;
  
  // Optimistic updates
  optimisticUpdate: <T>(
    action: () => Promise<T>,
    rollback: () => void
  ) => Promise<T>;

  loadMediaLibrary: (options?: { refresh?: boolean }) => Promise<void>;
  loadMoreMediaLibrary: () => Promise<void>;
  searchMediaLibrary: (search: string) => Promise<void>;
  
  // Property Panel actions
  openPropertyPanel: (componentId: string) => void;
  closePropertyPanel: () => void;
  setPropertyPanelTab: (tab: string) => void;
  setPropertyPanelScrollPosition: (position: number) => void;
  
  // Component Instance CRUD operations (for future use)
  addComponentToNode: (nodeId: string, component: ComponentInstance) => void;
  updateComponentInNode: (nodeId: string, componentId: string, updates: Partial<ComponentInstance>) => void;
  removeComponentFromNode: (nodeId: string, componentId: string) => void;
  reorderComponentsInNode: (nodeId: string, components: ComponentInstanceArray) => void;

  // Viewport sync actions
  mergeNodes: (newNodes: any[], detailLevel: 'skeleton' | 'minimal' | 'standard' | 'full') => void;
  getNodeDetailLevel: (nodeId: string) => 'skeleton' | 'minimal' | 'standard' | 'full' | undefined;
  setViewportSyncEnabled: (enabled: boolean) => void;

  // Position index actions
  setNodePositions: (positions: Map<string, { x: number; y: number; width: number; height: number }>) => void;

  // Search actions
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SiteBuilderState['searchResults']) => void;
  setSearchIsLoading: (isLoading: boolean) => void;
  // BUG-009 FIX: Viewport state save/restore for search
  saveViewportBeforeSearch: (viewport: { x: number; y: number; zoom: number }) => void;
  clearViewportBeforeSearch: () => void;

  // Navigation actions
  jumpToNode: (nodeId: string) => void;
  addToNavigationHistory: (nodeId: string) => void;
  setIsJumping: (isJumping: boolean) => void;
}


export const useSiteBuilderStore = create<SiteBuilderState>()(
  immer((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    websiteId: null,
    websiteRevision: null,
    pageTypes: [],
    pageTypesLoaded: false,
    pageTypesLoading: false,
    pageTypesError: null,
    contentTypesAll: [],
    contentTypeCatalog: {},
    contentTypesLoaded: false,
    contentTypesLoading: false,
    contentTypesError: null,
    contentTypesWebsiteId: null,
    componentTypesAll: [],
    componentTypesLoaded: false,
    componentTypesLoading: false,
    componentTypesError: null,
    selectedNodes: [],
    selectedComponentId: null,
    saveStatus: 'idle',
    isLoading: false,
    errorState: null,
    canUndo: false,
    canRedo: false,
    isUndoRedoInProgress: false,
    previousNodes: [],
    previousEdges: [],
    
    // Global Component initial state
    globalComponents: new Map(),
    globalUsages: new Map(),
    isLoadingGlobal: false,
    globalError: null,
    optimisticGlobalUpdates: new Map(),

    mediaLibrary: {
      items: [],
      isLoading: false,
      error: null,
      search: '',
      nextCursor: null,
      hasMore: false,
      lastLoadedWebsiteId: null
    },

    // Viewport sync initial state
    loadedNodeDetails: new Map(),
    viewportSyncEnabled: false,

    // Position index initial state
    nodePositionIndex: new Map(),

    // Search initial state
    searchQuery: '',
    searchResults: [],
    searchIsOpen: false,
    searchIsLoading: false,
    // BUG-009 FIX: Viewport state before search
    viewportBeforeSearch: null,

    // Navigation initial state
    focusedNodeId: null,
    navigationHistory: [],
    isJumping: false,

    // Property Panel initial state
    propertyPanelState: {
      isOpen: false,
      selectedComponentId: null,
      activeTab: 'properties',
      scrollPosition: 0
    },
    
    // Load structure from API
    loadStructure: async (websiteId: string, signal?: AbortSignal) => {
      const requestSeq = ++loadStructureRequestSeq;
      set((state) => {
        state.isLoading = true;
        state.errorState = null;
        state.websiteId = websiteId;
        state.pageTypesLoaded = false;
        state.pageTypesLoading = false;
        state.pageTypesError = null;
        state.pageTypes = [];
        state.contentTypesAll = [];
        state.contentTypeCatalog = {};
        state.contentTypesLoaded = false;
        state.contentTypesLoading = false;
        state.contentTypesError = null;
        state.contentTypesWebsiteId = null;
        // Reset viewport sync state
        state.loadedNodeDetails = new Map();
        state.viewportSyncEnabled = false;
        // Reset position index
        state.nodePositionIndex = new Map();
        // Reset search state
        state.searchQuery = '';
        state.searchResults = [];
        state.searchIsOpen = false;
        state.searchIsLoading = false;
        state.viewportBeforeSearch = null;
        // Reset navigation state
        state.focusedNodeId = null;
        state.navigationHistory = [];
        state.isJumping = false;
      });

      try {
        // Check for mode override in URL params (for debugging large sites)
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const forceFullMode = urlParams?.get('loadMode') === 'full';
        const apiUrl = forceFullMode
          ? `/api/studio/sitemap/${websiteId}?mode=full`
          : `/api/studio/sitemap/${websiteId}`;

        if (forceFullMode) {
          console.info('[Store] Forcing full load mode via URL parameter');
        }

        const response = await fetch(apiUrl, signal ? { signal } : undefined);
        if (!response.ok) {
          // EC-01: Handle specific error status codes
          if (response.status === 404) {
            // Try to parse error message from API response
            try {
              const errorData = await response.json();
              throw new Error(errorData?.error || 'Website not found. The website you are looking for does not exist or has been deleted.');
            } catch (parseError) {
              // If parsing fails, use a generic 404 message
              if (parseError instanceof Error && parseError.message.includes('not found')) {
                throw parseError;
              }
              throw new Error('Website not found. Please select a valid website from your dashboard.');
            }
          }
          if (response.status === 401) {
            throw new Error('Unauthorized. Please sign in to access this website.');
          }
          if (response.status === 403) {
            throw new Error('Access denied. You do not have permission to view this website.');
          }
          throw new Error('Failed to load sitemap. Please try again.');
        }

        const data = await response.json();
        if (requestSeq !== loadStructureRequestSeq) {
          return;
        }
        const incomingNodes = Array.isArray(data.nodes) ? data.nodes : [];
        const incomingEdges = Array.isArray(data.edges) ? data.edges : [];
        const confirmedEmpty = data.meta?.confirmedEmpty === true;

        // Check if viewport sync is supported (large site with skeleton load)
        const supportsViewportSync = data.meta?.supportsViewportSync === true;
        const loadMode = data.meta?.loadMode || 'full';

        // Get default node dimensions from response meta (fallback for nodes without per-node dimensions)
        const defaultNodeWidth = data.meta?.nodeWidth || 280;
        const defaultNodeHeight = 120; // Note: dynamicHeights means per-node heights are used

        set((state) => {
          if (incomingNodes.length === 0 && state.nodes.length > 0 && !confirmedEmpty) {
            state.isLoading = false;
            return;
          }
          state.nodes = incomingNodes;
          state.edges = incomingEdges;
          state.websiteRevision = typeof data.revision === 'number' ? data.revision : null;
          // BUG-003 FIX: Deep clone to ensure previousNodes doesn't share references with nodes
          state.previousNodes = deepCloneNodes(incomingNodes);
          state.previousEdges = deepCloneNodes(incomingEdges);
          state.isLoading = false;
          state.viewportSyncEnabled = supportsViewportSync;

          // Initialize detail levels based on load mode
          if (loadMode === 'skeleton') {
            for (const node of incomingNodes) {
              state.loadedNodeDetails.set(node.id, 'skeleton');
            }
          } else {
            for (const node of incomingNodes) {
              state.loadedNodeDetails.set(node.id, 'full');
            }
          }

          // Build position index from nodes - use per-node dimensions when available (dynamic heights)
          const positionIndex = new Map<string, { x: number; y: number; width: number; height: number }>();
          for (const node of incomingNodes) {
            positionIndex.set(node.id, {
              x: node.position.x,
              y: node.position.y,
              // Use per-node dimensions from server when available (dynamic heights)
              width: node.width ?? defaultNodeWidth,
              height: node.height ?? defaultNodeHeight,
            });
          }
          state.nodePositionIndex = positionIndex;
        });

        // Initialize undoManager with loaded state
        if (incomingNodes.length > 0 || confirmedEmpty) {
          undoManager.initialize(incomingNodes, incomingEdges);
        }
        
        // Initialize save manager
        saveManager.initialize(websiteId, {
          getWebsiteRevision: () => get().websiteRevision,
          onWebsiteRevisionChange: (revision) => get().setWebsiteRevision(revision),
          onStatusChange: (status) => get().setSaveStatus(status),
          onError: (error) => get().setError({
            message: error.message,
            retry: () => saveManager.retry()
          }),
          // TKT-002: Handle CREATE operations - reload to reconcile temp IDs with server IDs
          onSaveComplete: (result) => {
            // Check if any CREATE operations were performed
            const hasCreateOps = result.results?.some(r => r.operationType === 'CREATE');
            if (hasCreateOps) {
              console.log('[Store] CREATE operations detected - reloading to reconcile IDs and positions');
              // Reload structure to:
              // 1. Replace temp client IDs (node-1234567890) with real server IDs
              // 2. Get correct server-calculated positions (fixes 0,0 positioning bug)
              // Note: isLoading flag prevents save during reload (prevents infinite loop)
              get().loadStructure(websiteId);
            }
          },
          // Handle layout recalculation when component changes affect node heights
          onLayoutRecalculated: () => {
            console.log('[Store] Layout recalculated - refreshing positions');
            // Reload structure to get updated positions (prevents node overlap)
            get().loadStructure(websiteId);
          }
        });
        // Since this was a fresh load, ensure status reflects a clean state
        set((s) => { s.saveStatus = 'saved' as const; });
        // Load global components catalog so UI can distinguish shared instances
        try {
          await get().loadGlobalComponents(websiteId);
        } catch (e) {
          console.warn('[Store] Failed to load global components', e);
        }

        try {
          await get().loadPageTypes(websiteId);
        } catch (e) {
          console.warn('[Store] Failed to load page types', e);
        }

      } catch (error) {
        // BUG-001 FIX: Handle AbortError gracefully - request was cancelled, no need to update state
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('[Store] loadStructure error:', error);
        set((state) => {
          state.isLoading = false;
          state.errorState = {
            message: error instanceof Error ? error.message : 'Failed to load sitemap',
            retry: () => get().loadStructure(websiteId)
          };
        });
      }
    },

    setWebsiteRevision: (revision) => set((state) => {
      state.websiteRevision = revision;
      saveManager.setWebsiteRevision(revision);
    }),
    
    // Add a new node
    // TKT-001: Updated to support position-based weight calculation for correct sibling placement
    addNode: (parentId, data, options) => {
      // TODO: Implement proper optimistic update pattern:
      // 1. Generate temporary client ID
      // 2. Add node optimistically to UI
      // 3. Send request to server and get real ID
      // 4. Replace temporary ID with server ID in state
      // 5. Rollback on failure
      // Current implementation uses temporary IDs but doesn't reconcile with server IDs
      const nodeType = 'page'; // Default type for new nodes
      const metadata = {
        status: 'draft',
        ...(data.metadata ?? {}),
      } as Record<string, unknown>;

      // TKT-001: Calculate weight based on position relative to anchor node
      const currentState = get();
      let calculatedWeight = data.weight ?? 0;
      const { anchorId, position } = options || {};

      if (anchorId && position && parentId) {
        // Find siblings (nodes that share the same parent)
        const siblingEdges = currentState.edges.filter(e => e.source === parentId);
        const siblingIds = new Set(siblingEdges.map(e => e.target));
        const siblings = currentState.nodes.filter(n => siblingIds.has(n.id));

        // Get anchor node's current weight (position in sibling order)
        const anchorNode = currentState.nodes.find(n => n.id === anchorId);
        const anchorWeight = (anchorNode?.data as any)?.weight ??
          siblings.findIndex(s => s.id === anchorId);

        if (position === 'left') {
          // Insert at anchor's position, shift anchor and later siblings right
          calculatedWeight = anchorWeight;
          // We'll need to increment weights of anchor and later siblings
        } else if (position === 'right') {
          // Insert after anchor
          calculatedWeight = anchorWeight + 1;
          // Increment weights of siblings after the new position
        }

        // For top/bottom (child insertion), calculate based on children
      } else if (position === 'top' && parentId) {
        // Add as first child
        calculatedWeight = 0;
      } else if (position === 'bottom' && parentId) {
        // Add as last child
        const childEdges = currentState.edges.filter(e => e.source === parentId);
        calculatedWeight = childEdges.length; // Next position after existing children
      }

      const newNode: SitemapNode = {
        id: `node-${Date.now()}`, // Temporary ID, needs server reconciliation
        type: nodeType,
        position: { x: 0, y: 0 },
        data: {
          label: data.title || 'New Page',
          slug: data.slug || 'new-page',
          components: [],
          childCount: 0,
          hasContent: true, // Pages have content
          contentTypeCategory: 'page' as ContentTypeCategory,
          contentTypeId: data.contentTypeId,
          metadata,
          weight: calculatedWeight, // TKT-001: Store weight in node data
        }
      };

      // TKT-001: Include weight in the data for save operation
      const dataWithWeight: CreateNodeData = {
        ...data,
        weight: calculatedWeight,
      };

      set((state) => {
        // TKT-001: Shift sibling weights when inserting left/right
        if (anchorId && parentId && (position === 'left' || position === 'right')) {
          const siblingEdges = state.edges.filter(e => e.source === parentId);
          const siblingIds = new Set(siblingEdges.map(e => e.target));

          state.nodes.forEach(node => {
            if (siblingIds.has(node.id)) {
              const nodeWeight = (node.data as any)?.weight ?? 0;
              // Increment weights for nodes at or after the insertion point
              if (nodeWeight >= calculatedWeight) {
                (node.data as any).weight = nodeWeight + 1;
              }
            }
          });
        }

        // TKT-001: Shift child weights when inserting at top
        if (position === 'top' && parentId) {
          const childEdges = state.edges.filter(e => e.source === parentId);
          const childIds = new Set(childEdges.map(e => e.target));

          state.nodes.forEach(node => {
            if (childIds.has(node.id)) {
              const nodeWeight = (node.data as any)?.weight ?? 0;
              (node.data as any).weight = nodeWeight + 1;
            }
          });
        }

        state.nodes.push(newNode);

        if (parentId) {
          state.edges.push({
            id: `${parentId}-${newNode.id}`,
            source: parentId,
            target: newNode.id,
            type: 'smoothstep'
          });
        }
      });
      
      const state = get();
      
      // Capture state for undo/redo
      state.captureState();
      
      // Only save if not during undo/redo
      if (!state.isUndoRedoInProgress) {
        const operations = transformFromReactFlow(
          state.nodes,
          state.edges,
          state.previousNodes,
          state.previousEdges
        );

        // Update previous state for next diff
        // BUG-003 FIX: Deep clone to prevent reference sharing
        set((s) => {
          s.previousNodes = deepCloneNodes(state.nodes);
          s.previousEdges = deepCloneNodes(state.edges);
        });

        saveManager.addOperations(operations);
      }
    },

    // Update a node
    updateNode: (nodeId, updates) => {
      set((state) => {
        const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex >= 0) {
          Object.assign(state.nodes[nodeIndex], updates);
        }
      });
      
      const state = get();
      
      // Capture state for undo/redo
      state.captureState();
      
      // Only save if not during undo/redo
      if (!state.isUndoRedoInProgress) {
        const operations = transformFromReactFlow(
          state.nodes,
          state.edges,
          state.previousNodes,
          state.previousEdges
        );

        // Update previous state for next diff
        // BUG-003 FIX: Deep clone to prevent reference sharing
        set((s) => {
          s.previousNodes = deepCloneNodes(state.nodes);
          s.previousEdges = deepCloneNodes(state.edges);
        });

        saveManager.addOperations(operations);
      }
    },

    // Delete nodes
    deleteNodes: (nodeIds) => {
      set((state) => {
        // Remove nodes
        state.nodes = state.nodes.filter(n => !nodeIds.includes(n.id));
        
        // Remove related edges
        state.edges = state.edges.filter(
          e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
        );
        
        // Clear selection if deleted nodes were selected
        state.selectedNodes = state.selectedNodes.filter(id => !nodeIds.includes(id));
      });
      
      // Capture state for undo/redo
      get().captureState();
      
      // Only save if not during undo/redo
      if (!get().isUndoRedoInProgress) {
        // Generate delete operations
        const operations = nodeIds.map(nodeId => ({
          type: 'DELETE' as const,
          nodeId
        }));
        saveManager.addOperations(operations);
      }
    },
    
    // Move a node to a new parent
    moveNode: (nodeId, newParentId) => {
      set((state) => {
        // Remove old parent edge
        state.edges = state.edges.filter(e => e.target !== nodeId);
        
        // Add new parent edge
        if (newParentId) {
          state.edges.push({
            id: `${newParentId}-${nodeId}`,
            source: newParentId,
            target: nodeId,
            type: 'smoothstep'
          });
        }
      });
      
      // Capture state for undo/redo
      get().captureState();
      
      // Only save if not during undo/redo
      if (!get().isUndoRedoInProgress) {
        // Generate move operation
        saveManager.addOperation({
          type: 'MOVE',
          nodeId,
          newParentId: newParentId === null ? undefined : newParentId
        });
      }
    },
    
    // Selection management
    setSelectedNodes: (nodeIds) => set((state) => {
      state.selectedNodes = nodeIds;
      // Clear component selection when page node is selected
      if (nodeIds.length > 0) {
        state.selectedComponentId = null;
      }
    }),
    
    clearSelection: () => set((state) => {
      state.selectedNodes = [];
      state.selectedComponentId = null;
    }),
    
    setSelectedComponentId: (componentId) => set((state) => {
      state.selectedComponentId = componentId;
      // Don't clear node selection when component is selected
    }),
    
    getSelectedComponent: () => {
      const { selectedComponentId, nodes } = get();
      if (!selectedComponentId) return null;
      
      // Find the component across all nodes - early return for performance
      for (const node of nodes) {
        if (node.data.components && Array.isArray(node.data.components)) {
          const components = node.data.components as ComponentInstanceArray;
          const component = components.find(c => c.id === selectedComponentId);
          if (component) return component;
        }
      }
      return null;
    },
    
    // React Flow change handlers
    onNodesChange: (changes) => {
      set((state) => {
        // Apply React Flow changes
        changes.forEach((change) => {
          if (change.type === 'position' && 'dragging' in change && change.dragging === false) {
            const node = state.nodes.find(n => n.id === change.id);
            if (node && 'position' in change) {
              node.position = change.position!;
            }
          }
          if (change.type === 'select' && 'selected' in change) {
            if (change.selected) {
              if (!state.selectedNodes.includes(change.id)) {
                state.selectedNodes.push(change.id);
              }
            } else {
              state.selectedNodes = state.selectedNodes.filter(id => id !== change.id);
            }
          }
        });
      });
    },
    
    onEdgesChange: (changes) => {
      set((state) => {
        // Apply React Flow edge changes
        changes.forEach((change) => {
          if (change.type === 'remove') {
            state.edges = state.edges.filter(e => e.id !== change.id);
          }
        });
      });
    },
    
    onConnect: (connection) => {
      set((state) => {
        // Add new connection
        state.edges.push({
          id: `${connection.source}-${connection.target}`,
          source: connection.source || '',
          target: connection.target || '',
          type: 'smoothstep'
        });
      });
      
      // Save the new connection
      saveManager.addOperation({
        type: 'MOVE',
        nodeId: connection.target || '',
        newParentId: connection.source === null ? undefined : connection.source
      });
    },
    
    // Save status management
    setSaveStatus: (status) => set((state) => {
      state.saveStatus = status;
    }),
    
    setError: (error) => set((state) => {
      state.errorState = error;
    }),
    
    // History management with UndoManager
    captureState: () => {
      const { nodes, edges } = get();
      undoManager.pushState(nodes, edges);
    },
    
    undo: () => {
      set((state) => {
        state.isUndoRedoInProgress = true;
      });
      
      const historyState = undoManager.undo();
      if (historyState) {
        set((state) => {
          state.nodes = historyState.nodes;
          state.edges = historyState.edges;
          // Update previousNodes/edges for proper diff calculation
          // BUG-003 FIX: Deep clone to prevent reference sharing
          state.previousNodes = deepCloneNodes(historyState.nodes);
          state.previousEdges = deepCloneNodes(historyState.edges);
        });
      }

      set((state) => {
        state.isUndoRedoInProgress = false;
      });
    },

    redo: () => {
      set((state) => {
        state.isUndoRedoInProgress = true;
      });

      const historyState = undoManager.redo();
      if (historyState) {
        set((state) => {
          state.nodes = historyState.nodes;
          state.edges = historyState.edges;
          // Update previousNodes/edges for proper diff calculation
          // BUG-003 FIX: Deep clone to prevent reference sharing
          state.previousNodes = deepCloneNodes(historyState.nodes);
          state.previousEdges = deepCloneNodes(historyState.edges);
        });
      }
      
      set((state) => {
        state.isUndoRedoInProgress = false;
      });
    },
    
    // Global Component actions
    toggleGlobalState: async (componentId, componentData) => {
      set((state) => {
        state.isLoadingGlobal = true;
        state.globalError = null;
      });

      try {
        const websiteId = get().websiteId;
        if (!websiteId) throw new Error('No website ID available');

        // Locate containing node and instance
        const stateSnapshot = get();
        const containingNode = stateSnapshot.nodes.find(n => Array.isArray(n.data?.components) && (n.data.components as any[]).some((c: any) => c.id === componentId));
        const pageId = (containingNode?.data as any)?.websitePageId as string | undefined;
        const selectedInstance: any | undefined = containingNode && Array.isArray(containingNode.data?.components)
          ? (containingNode.data.components as any[]).find((c: any) => c.id === componentId)
          : undefined;
        const currentGlobalId: string | undefined = selectedInstance?.globalComponentId || selectedInstance?.props?.sharedComponentId;
        const isCurrentlyGlobal = !!(currentGlobalId && get().globalComponents.has(currentGlobalId));

        // Create (or ensure) shared component
        const response = await fetch('/api/studio/site-builder/global-components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentId,
            websiteId,
            name: componentData.name || 'Unnamed Component',
            type: componentData.type || 'generic',
            category: componentData.category || 'shared',
            content: componentData.properties || {},
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create or fetch global component');
        }

        const result = await response.json();
        const sharedId: string = result.id || result?.data?.id || result?.meta?.id;

        // If newly global and we have a page context, convert instance to shared overrides
        if (!isCurrentlyGlobal && sharedId && pageId) {
          const convertResponse = await fetch(`/api/studio/site-builder/pages/${pageId}/resolved?websiteId=${encodeURIComponent(websiteId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              updates: [
                { type: 'convertFullPropsToOverrides', instanceId: componentId, sharedId }
              ]
            })
          });

          if (!convertResponse.ok) {
            const errorBody = await convertResponse.json().catch(() => null) as { error?: string } | null;
            throw new Error(errorBody?.error || 'Failed to convert instance to shared overrides');
          }
        }

        // Refresh catalogs and structure to reflect changes
        try { await get().loadGlobalComponents(websiteId); } catch {}
        try { await get().loadStructure(websiteId); } catch {}

        set((state) => {
          if (sharedId) {
            const next = new Map(state.globalComponents);
            next.set(sharedId, {
              id: sharedId,
              componentId: result.componentId,
              websiteId,
              name: componentData.name,
              type: componentData.type,
              properties: componentData.properties,
              usageCount: result.usageCount,
              lastModified: new Date(),
              createdBy: 'current-user'
            });
            state.globalComponents = next; // replace to trigger subscribers
          }
          state.isLoadingGlobal = false;
        });

      } catch (error) {
        set((state) => {
          state.globalError = error instanceof Error ? error.message : 'Failed to toggle global state';
          state.isLoadingGlobal = false;
        });
        throw error;
      }
    },

    loadContentTypeCatalog: async (websiteId: string, options: { force?: boolean } = {}) => {
      if (!websiteId) {
        return;
      }

      const { contentTypesLoaded, contentTypesWebsiteId, contentTypesLoading } = get();
      if (!options.force) {
        if (contentTypesLoaded && contentTypesWebsiteId === websiteId) {
          return;
        }
        if (contentTypesLoading && contentTypesWebsiteId === websiteId) {
          return;
        }
      }

      set((state) => {
        state.contentTypesLoading = true;
        state.contentTypesError = null;
        state.componentTypesLoading = true;
        state.componentTypesError = null;
        state.contentTypesWebsiteId = websiteId;
        state.pageTypesLoading = true;
        state.pageTypesLoaded = false;
        state.pageTypesError = null;
      });

      try {
        const response = await fetch(`/api/content-types?websiteId=${websiteId}`);
        if (!response.ok) {
          throw new Error('Failed to load content types');
        }

        const payload = await response.json();
        const rawTypes: ContentTypeWithParsedFields[] = Array.isArray(payload?.data)
          ? payload.data as ContentTypeWithParsedFields[]
          : [];
        await ensureCmsRegistryInitialized();
        const componentTypes = await fetchAllComponentTypes(websiteId);
        const mappedComponents = mapComponentTypesToContentTypes(componentTypes);
        const hasFolderTypes = rawTypes.some((type) => {
          const category = typeof type.category === 'string' ? type.category.toLowerCase() : '';
          return category === 'folder';
        });
        const folderFallback = hasFolderTypes ? [] : [createDefaultFolderType(websiteId)];
        const combinedTypes = [...rawTypes, ...folderFallback, ...mappedComponents];

        const catalog = groupContentTypesByCategory(combinedTypes);
        const { pageTypes, hasRealTypes } = derivePageTypeOptions(combinedTypes);

        set((state) => {
          state.contentTypesAll = combinedTypes;
          state.componentTypesAll = componentTypes;
          state.contentTypeCatalog = catalog;
          state.contentTypesLoading = false;
          state.contentTypesLoaded = true;
          state.contentTypesError = null;
          state.componentTypesLoading = false;
          state.componentTypesLoaded = true;
          state.componentTypesError = null;
          state.contentTypesWebsiteId = websiteId;
          state.pageTypes = pageTypes;
          state.pageTypesLoaded = true;
          state.pageTypesLoading = false;
          state.pageTypesError = hasRealTypes ? null : 'No template page types are registered for this site yet.';
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load content types';
        console.error('[Store] Failed to load content types', error);
        set((state) => {
          state.contentTypesLoading = false;
          state.contentTypesLoaded = false;
          state.contentTypesError = message;
          state.contentTypesAll = [];
          state.contentTypeCatalog = {};
          state.contentTypesWebsiteId = null;
          state.componentTypesAll = [];
          state.componentTypesLoading = false;
          state.componentTypesLoaded = false;
          state.componentTypesError = message;
          state.pageTypesLoading = false;
          state.pageTypesLoaded = false;
          state.pageTypesError = message;
          state.pageTypes = [];
        });
      }
    },

    loadPageTypes: async (websiteId: string) => {
      await get().loadContentTypeCatalog(websiteId);
    },
    
    loadGlobalComponents: async (websiteId) => {
      set((state) => {
        state.isLoadingGlobal = true;
        state.globalError = null;
      });
      
      try {
        const response = await fetch(`/api/studio/site-builder/global-components?websiteId=${websiteId}`);
        
        if (!response.ok) {
          throw new Error('Failed to load global components');
        }
        
        const data = await response.json();

        const list = Array.isArray(data.components) ? data.components : (Array.isArray(data) ? data : []);
        const nextMap = new Map<string, any>();
        list.forEach((gc: any) => {
          nextMap.set(gc.id, { ...gc, lastModified: new Date(gc.lastModified) });
        });

        set((state) => {
          state.globalComponents = nextMap; // replace reference to trigger subscribers
          state.isLoadingGlobal = false;
        });
        
      } catch (error) {
        set((state) => {
          state.globalError = error instanceof Error ? error.message : 'Failed to load global components';
          state.isLoadingGlobal = false;
        });
      }
    },
    
    propagateGlobalChanges: async (globalId, properties, _options = {}) => {
      // In the unified model, updating a global writes once; pages reflect on read.
      set((state) => {
        state.isLoadingGlobal = true;
        state.globalError = null;
      });

      try {
        const response = await fetch(`/api/studio/site-builder/global-components/${globalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: properties })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to update global component');
        }

        const result = await response.json();

        set((state) => {
          const component = state.globalComponents.get(globalId);
          if (component) {
            const next = new Map(state.globalComponents);
            next.set(globalId, { ...component, properties, lastModified: new Date() });
            state.globalComponents = next; // replace map to notify subscribers
          }
          state.isLoadingGlobal = false;
        });

        return result;
      } catch (error) {
        set((state) => {
          state.globalError = error instanceof Error ? error.message : 'Failed to update global component';
          state.isLoadingGlobal = false;
        });
        throw error;
      }
    },
    
    getImpactAnalysis: async (globalId) => {
      try {
        const response = await fetch(`/api/studio/site-builder/global-components/${globalId}/impact`);
        
        if (!response.ok) {
          throw new Error('Failed to get impact analysis');
        }
        
        const data = await response.json();
        return data as ImpactAnalysis;
        
      } catch (error) {
        console.error('Failed to get impact analysis:', error);
        throw error;
      }
    },
    
    applyOptimisticGlobalUpdate: (componentId, update) => {
      set((state) => {
        state.optimisticGlobalUpdates.set(componentId, update);

        // Apply update to component if it exists (clone map to notify)
        if (state.globalComponents.has(componentId)) {
          const current = state.globalComponents.get(componentId);
          const updated = { ...current, ...update };
          const next = new Map(state.globalComponents);
          next.set(componentId, updated);
          state.globalComponents = next;
        }
      });
    },
    
    rollbackOptimisticGlobalUpdate: (componentId) => {
      set((state) => {
        state.optimisticGlobalUpdates.delete(componentId);
        // In a real implementation, you'd restore the original state here
      });
    },
    
    // Optimistic updates
    optimisticUpdate: async (action, rollback) => {
      const snapshot = {
        nodes: [...get().nodes],
        edges: [...get().edges]
      };
      
      try {
        const result = await action();
        return result;
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.nodes = snapshot.nodes;
          state.edges = snapshot.edges;
        });
        rollback();
        throw error;
      }
    },

    loadMediaLibrary: async ({ refresh = false } = {}) => {
      const { websiteId, mediaLibrary } = get()
      if (!websiteId) {
        return
      }

      const shouldReset = refresh || mediaLibrary.lastLoadedWebsiteId !== websiteId

      if (mediaLibrary.isLoading && !shouldReset) {
        return
      }

      set((state) => {
        state.mediaLibrary.isLoading = true
        state.mediaLibrary.error = null
        if (shouldReset) {
          state.mediaLibrary.items = []
          state.mediaLibrary.nextCursor = null
          state.mediaLibrary.hasMore = false
          state.mediaLibrary.lastLoadedWebsiteId = websiteId
        }
      })

      try {
        const params = new URLSearchParams({ websiteId, limit: '25' })
        if (mediaLibrary.search) {
          params.set('search', mediaLibrary.search)
        }

        const response = await fetch(`/api/studio/media?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Media request failed with status ${response.status}`)
        }

        const data = await response.json() as { items: MediaLibraryItem[]; nextCursor: string | null }
        set((state) => {
          state.mediaLibrary.items = data.items
          state.mediaLibrary.nextCursor = data.nextCursor ?? null
          state.mediaLibrary.hasMore = Boolean(data.nextCursor)
          state.mediaLibrary.lastLoadedWebsiteId = websiteId
          state.mediaLibrary.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.mediaLibrary.isLoading = false
          state.mediaLibrary.error = error instanceof Error ? error.message : 'Failed to load media assets'
        })
      }
    },

    loadMoreMediaLibrary: async () => {
      const { websiteId, mediaLibrary } = get()
      if (!websiteId || !mediaLibrary.nextCursor || mediaLibrary.isLoading || !mediaLibrary.hasMore) {
        return
      }

      set((state) => {
        state.mediaLibrary.isLoading = true
        state.mediaLibrary.error = null
      })

      try {
        const params = new URLSearchParams({
          websiteId,
          limit: '25',
          cursor: mediaLibrary.nextCursor
        })
        if (mediaLibrary.search) {
          params.set('search', mediaLibrary.search)
        }

        const response = await fetch(`/api/studio/media?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Media request failed with status ${response.status}`)
        }

        const data = await response.json() as { items: MediaLibraryItem[]; nextCursor: string | null }
        set((state) => {
          state.mediaLibrary.items = state.mediaLibrary.items.concat(data.items)
          state.mediaLibrary.nextCursor = data.nextCursor ?? null
          state.mediaLibrary.hasMore = Boolean(data.nextCursor)
          state.mediaLibrary.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.mediaLibrary.isLoading = false
          state.mediaLibrary.error = error instanceof Error ? error.message : 'Failed to load media assets'
        })
      }
    },

    searchMediaLibrary: async (search) => {
      set((state) => {
        state.mediaLibrary.search = search
      })
      await get().loadMediaLibrary({ refresh: true })
    },
    
    // Property Panel actions
    openPropertyPanel: (componentId: string) => {
      set((state) => {
        state.propertyPanelState.isOpen = true;
        state.propertyPanelState.selectedComponentId = componentId;
        state.selectedNodes = [componentId];
      });
    },
    
    closePropertyPanel: () => {
      set((state) => {
        state.propertyPanelState.isOpen = false;
        state.propertyPanelState.selectedComponentId = null;
        state.propertyPanelState.scrollPosition = 0;
      });
    },
    
    setPropertyPanelTab: (tab: string) => {
      set((state) => {
        state.propertyPanelState.activeTab = tab;
      });
    },
    
    setPropertyPanelScrollPosition: (position: number) => {
      set((state) => {
        state.propertyPanelState.scrollPosition = position;
      });
    },
    
    // Component Instance CRUD operations (for future use)
    addComponentToNode: (nodeId: string, component: ComponentInstance) => {
      // Get pageId before update
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      const pageId = (node?.data as any)?.websitePageId;

      set((state) => {
        const node = state.nodes.find(n => n.id === nodeId);
        if (node && node.data.components) {
          if (Array.isArray(node.data.components)) {
            (node.data.components as ComponentInstanceArray).push(component);
          }
        }
      });

      // Capture state for undo/redo
      get().captureState();

      // Queue save operation
      if (!get().isUndoRedoInProgress && pageId) {
        const updatedNode = get().nodes.find(n => n.id === nodeId);
        const components = Array.isArray(updatedNode?.data.components)
          ? cloneComponentsForSave(updatedNode.data.components as ComponentInstanceArray)
          : undefined;
        saveManager.addComponentOperation({
          type: 'COMPONENT_ADD',
          nodeId: pageId,
          componentId: component.id,
          data: { components, ifUnchangedSince: pageUpdatedAtForSave(updatedNode as any) }
        });
      }
    },
    
    updateComponentInNode: (nodeId: string, componentId: string, updates: Partial<ComponentInstance>) => {
      // Find current component to check if global
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      let globalComponentId: string | undefined;
      let pageId: string | undefined;

      if (node?.data.components && Array.isArray(node.data.components)) {
        const component = (node.data.components as ComponentInstanceArray).find(c => c.id === componentId);
        globalComponentId = (component as any)?.globalComponentId;
      }
      pageId = (node?.data as any)?.websitePageId;

      // Update state
      set((state) => {
        const node = state.nodes.find(n => n.id === nodeId);
        if (node && node.data.components && Array.isArray(node.data.components)) {
          const components = node.data.components as ComponentInstanceArray;
          const componentIndex = components.findIndex(c => c.id === componentId);
          if (componentIndex >= 0) {
            Object.assign(components[componentIndex], updates);
          }
        }
      });

      // Capture state for undo/redo
      get().captureState();

      // Queue save operation (deduped and debounced by saveManager)
      if (!get().isUndoRedoInProgress && pageId) {
        saveManager.addComponentOperation({
          type: 'COMPONENT_UPDATE',
          nodeId: pageId,
          componentId,
          data: updates as Record<string, any>,
          globalComponentId
        });
      }
    },
    
    removeComponentFromNode: (nodeId: string, componentId: string) => {
      // Get pageId before update
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      const pageId = (node?.data as any)?.websitePageId;

      set((state) => {
        const node = state.nodes.find(n => n.id === nodeId);
        if (node && node.data.components && Array.isArray(node.data.components)) {
          const components = node.data.components as ComponentInstanceArray;
          node.data.components = components.filter(c => c.id !== componentId);
        }
      });

      // Capture state for undo/redo
      get().captureState();

      // Queue delete operation
      if (!get().isUndoRedoInProgress && pageId) {
        const updatedNode = get().nodes.find(n => n.id === nodeId);
        const components = Array.isArray(updatedNode?.data.components)
          ? cloneComponentsForSave(updatedNode.data.components as ComponentInstanceArray)
          : undefined;
        saveManager.addComponentOperation({
          type: 'COMPONENT_DELETE',
          nodeId: pageId,
          componentId,
          data: { components, ifUnchangedSince: pageUpdatedAtForSave(updatedNode as any) }
        });
      }
    },
    
    reorderComponentsInNode: (nodeId: string, components: ComponentInstanceArray) => {
      // Get pageId before update
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      const pageId = (node?.data as any)?.websitePageId;

      set((state) => {
        const node = state.nodes.find(n => n.id === nodeId);
        if (node) {
          node.data.components = components;
        }
      });

      // Capture state for undo/redo
      get().captureState();

      // Queue reorder operation - send the new component order
      if (!get().isUndoRedoInProgress && pageId) {
        // For reorder, we send the component IDs in new order
        saveManager.addComponentOperation({
          type: 'COMPONENT_REORDER',
          nodeId: pageId,
          componentId: 'reorder', // Special marker for reorder operations
          data: { components: cloneComponentsForSave(components), ifUnchangedSince: pageUpdatedAtForSave(node as any) }
        });
      }
    },

    // Viewport sync actions
    mergeNodes: (newNodes, detailLevel) => {
      if (!newNodes || newNodes.length === 0) return;

      // DEBUG: Log what mergeNodes receives
      console.log('[Store:mergeNodes] Called with:', {
        nodeCount: newNodes.length,
        detailLevel,
        firstNode: newNodes[0] ? {
          id: newNodes[0].id,
          hasData: !!newNodes[0].data,
          dataKeys: newNodes[0].data ? Object.keys(newNodes[0].data) : [],
          hasComponents: !!newNodes[0].data?.components,
          componentCount: newNodes[0].data?.components?.length || 0,
          _detailLevel: newNodes[0].data?._detailLevel,
        } : null,
      });

      set((state) => {
        const detailPriority = { skeleton: 0, minimal: 1, standard: 2, full: 3 };
        const existingMap = new Map(state.nodes.map(n => [n.id, n]));

        for (const newNode of newNodes) {
          const existing = existingMap.get(newNode.id);
          const existingDetail = state.loadedNodeDetails.get(newNode.id) || 'skeleton';

          // Only update if new data is higher or equal detail
          if (detailPriority[detailLevel] >= detailPriority[existingDetail]) {
            // IMPORTANT: Preserve position from skeleton load (it has correct layout)
            const position = existing?.position || newNode.position || { x: 0, y: 0 };

            // Handle ViewportAPI format (data in newNode.data) vs legacy format (newNode.page)
            // ViewportAPI returns: { id, type, position, data: { label, slug, components, ... } }
            const nodeData = newNode.data as Record<string, unknown> | undefined;
            const pageData = newNode.page;

            // Extract values from either format
            const label = nodeData?.label || pageData?.title || newNode.slug || existing?.data?.label || 'Untitled';
            const slug = nodeData?.slug || newNode.slug || existing?.data?.slug;
            const fullPath = nodeData?.fullPath || newNode.fullPath || existing?.data?.fullPath;
            const status = nodeData?.status || pageData?.status || (existing?.data as Record<string, unknown>)?.status || 'draft';
            const websitePageId = nodeData?.websitePageId || newNode.websitePageId || existing?.data?.websitePageId;
            const metadata = nodeData?.metadata || pageData?.metadata || existing?.data?.metadata;

            // Get components from either format
            const pageContent = pageData?.content;
            const components = (nodeData?.components as unknown[] | undefined) || pageContent?.components || [];

            // Get dynamic node dimensions (for level-based heights)
            const _nodeWidth = nodeData?._nodeWidth || (existing?.data as any)?._nodeWidth;
            const _nodeHeight = nodeData?._nodeHeight || (existing?.data as any)?._nodeHeight;

            const mergedNode = {
              ...existing,
              id: newNode.id,
              type: existing?.type || newNode.type || 'page',
              position, // Always preserve existing position
              data: {
                ...(existing?.data || {}),
                label,
                slug,
                fullPath,
                status,
                hasContent: !!websitePageId,
                websitePageId,
                _detailLevel: detailLevel,
                // Only mark as not needing detail load if we have 'full' detail (with components)
                _needsDetailLoad: detailLevel !== 'full',
                // Include page content if available
                ...(components.length > 0 && {
                  components,
                  componentCount: components.length,
                }),
                // Preserve metadata if not overwriting with empty
                metadata,
                // Preserve dynamic node dimensions for level-based heights
                ...(_nodeWidth !== undefined && { _nodeWidth }),
                ...(_nodeHeight !== undefined && { _nodeHeight }),
              },
            };

            existingMap.set(newNode.id, mergedNode as SitemapNode);
            state.loadedNodeDetails.set(newNode.id, detailLevel);
          }
        }

        state.nodes = Array.from(existingMap.values());
      });
    },

    getNodeDetailLevel: (nodeId) => {
      return get().loadedNodeDetails.get(nodeId);
    },

    setViewportSyncEnabled: (enabled) => {
      set((state) => {
        state.viewportSyncEnabled = enabled;
      });
    },

    // Position index actions
    setNodePositions: (positions) => {
      set((state) => {
        state.nodePositionIndex = positions;
      });
    },

    // Search actions
    openSearch: () => {
      set((state) => {
        state.searchIsOpen = true;
      });
    },

    closeSearch: () => {
      set((state) => {
        state.searchIsOpen = false;
        state.searchQuery = '';
        state.searchResults = [];
      });
    },

    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    setSearchResults: (results) => {
      set((state) => {
        state.searchResults = results;
      });
    },

    setSearchIsLoading: (isLoading) => {
      set((state) => {
        state.searchIsLoading = isLoading;
      });
    },

    // BUG-009 FIX: Viewport state save/restore for search
    saveViewportBeforeSearch: (viewport) => {
      set((state) => {
        state.viewportBeforeSearch = viewport;
      });
    },

    clearViewportBeforeSearch: () => {
      set((state) => {
        state.viewportBeforeSearch = null;
      });
    },

    // Navigation actions
    jumpToNode: (nodeId) => {
      set((state) => {
        state.focusedNodeId = nodeId;
        state.isJumping = true;
        // Add to navigation history for back button
        if (state.navigationHistory[state.navigationHistory.length - 1] !== nodeId) {
          state.navigationHistory.push(nodeId);
          // Keep history limited to last 50 entries
          if (state.navigationHistory.length > 50) {
            state.navigationHistory.shift();
          }
        }
      });
    },

    addToNavigationHistory: (nodeId) => {
      set((state) => {
        if (state.navigationHistory[state.navigationHistory.length - 1] !== nodeId) {
          state.navigationHistory.push(nodeId);
          if (state.navigationHistory.length > 50) {
            state.navigationHistory.shift();
          }
        }
      });
    },

    setIsJumping: (isJumping) => {
      set((state) => {
        state.isJumping = isJumping;
      });
    }
  }))
);

// Set up the store state updater callback now that the store is created
storeStateUpdater = (canUndo: boolean, canRedo: boolean) => {
  useSiteBuilderStore.setState({ canUndo, canRedo });
};
