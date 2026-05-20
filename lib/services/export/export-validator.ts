/**
 * Export Validator Service
 * Validates export data for completeness, integrity, and potential issues
 */

import { FolderHierarchy, FolderNode } from './folder-exporter';
import { StandardExport } from './types';

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum ExportErrorCode {
  MISSING_DEPENDENCIES = 'EXPORT_001',
  CIRCULAR_REFERENCE = 'EXPORT_002',
  INVALID_STRUCTURE = 'EXPORT_003',
  MEMORY_LIMIT_EXCEEDED = 'EXPORT_004',
  TIMEOUT_EXCEEDED = 'EXPORT_005',
  VALIDATION_FAILED = 'EXPORT_006',
  UNRESOLVED_REFERENCE = 'EXPORT_007',
  DATA_INTEGRITY_ERROR = 'EXPORT_008'
}

export interface ValidationError {
  type: string;
  code: ExportErrorCode;
  severity: ValidationSeverity;
  message: string;
  details?: Record<string, unknown>;
  path?: string;
}

export interface ValidationWarning extends ValidationError {
  severity: ValidationSeverity.WARNING;
}

export interface ValidationInfo extends ValidationError {
  severity: ValidationSeverity.INFO;
}

export interface ValidationSummary {
  contentItems: number;
  contentTypes: number;
  components: number;
  folders: number;
  estimatedSize: number;
  estimatedTime: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
  summary: ValidationSummary;
}

export interface CircularDependency {
  cycle: string[];
  affectedComponents: string[];
}

export interface ComponentRelationship {
  componentId: string;
  dependencies: Array<{
    targetId: string;
    type: string;
  }>;
}

export class EnhancedExportValidator {
  private visitedNodes: Set<string> = new Set();
  private recursionStack: Set<string> = new Set();
  private circularDependencies: CircularDependency[] = [];
  private maxValidationTime = 5000; // 5 seconds
  private maxMemoryUsage = 50 * 1024 * 1024; // 50MB

  /**
   * Validates export data for completeness and integrity
   */
  async validateExportData(exportData: StandardExport): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const info: ValidationInfo[] = [];

    // Clear state from any previous validations
    this.visitedNodes.clear();
    this.recursionStack.clear();
    this.circularDependencies = [];

    try {
      // Check 1: Missing dependencies
      const missingDeps = await this.checkMissingDependencies(exportData);
      if (missingDeps.length > 0) {
        errors.push(...missingDeps);
      }

      // Check 2: Circular dependencies
      const circularDeps = await this.detectCircularDependencies(exportData);
      if (circularDeps.length > 0) {
        errors.push(...circularDeps);
      }

      // Check 3: Data integrity
      const integrityIssues = await this.checkDataIntegrity(exportData);
      errors.push(...integrityIssues.errors);
      warnings.push(...integrityIssues.warnings);

      // Check 4: Reference resolution
      const referenceIssues = await this.checkReferences(exportData);
      errors.push(...referenceIssues.errors);
      warnings.push(...referenceIssues.warnings);

      // Check 5: Unresolved references
      const unresolvedRefs = await this.checkUnresolvedReferences(exportData);
      if (unresolvedRefs.length > 0) {
        warnings.push(...unresolvedRefs);
      }

      // Check performance constraints
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.maxValidationTime) {
        warnings.push({
          type: 'performance',
          code: ExportErrorCode.VALIDATION_FAILED,
          severity: ValidationSeverity.WARNING,
          message: `Validation took ${elapsedTime}ms, exceeding the recommended ${this.maxValidationTime}ms limit`,
        } as ValidationWarning);
      }

      // Generate summary
      const summary = this.generateSummary(exportData, errors, warnings, info);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info,
        summary
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          type: 'validation_error',
          code: ExportErrorCode.VALIDATION_FAILED,
          severity: ValidationSeverity.ERROR,
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error instanceof Error ? { message: error.message, stack: error.stack } : undefined
        }],
        warnings: [],
        info: [],
        summary: this.generateSummary(exportData, [{} as ValidationError], [], [])
      };
    }
  }

  /**
   * Check for missing dependencies in the export data
   */
  async checkMissingDependencies(exportData: StandardExport): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const exportedIds = new Set<string>();

    // Collect all exported content and component IDs
    if (exportData.websitePages) {
      exportData.websitePages.forEach(item => {
        exportedIds.add(item.id);
      });
    }

    if (exportData.components) {
      exportData.components.forEach(comp => {
        exportedIds.add(comp.id);
      });
    }

    // Check component dependencies (if relationships are included in metadata)
    const componentRelationships = ((exportData.metadata as any) as Record<string, unknown>)?.componentRelationships as ComponentRelationship[] | undefined;
    if (componentRelationships && Array.isArray(componentRelationships)) {
      componentRelationships.forEach((relationship: ComponentRelationship) => {
        // Check if dependencies are included in export
        relationship.dependencies.forEach(dep => {
          if (!exportedIds.has(dep.targetId)) {
            errors.push({
              type: 'missing_dependency',
              code: ExportErrorCode.MISSING_DEPENDENCIES,
              severity: ValidationSeverity.ERROR,
              message: `Component "${relationship.componentId}" depends on missing component "${dep.targetId}"`,
              details: {
                source: relationship.componentId,
                target: dep.targetId,
                type: dep.type
              },
              path: `components.${relationship.componentId}`
            });
          }
        });
      });
    }

    // Check folder references
    if (exportData.folders && exportData.websitePages) {
      const folderIds = new Set<string>();
      // Collect folder IDs from the folder hierarchy
      if (exportData.folders.root && Array.isArray(exportData.folders.root)) {
        exportData.folders.root.forEach(rootFolder => {
          this.collectFolderIds(rootFolder, folderIds);
        });
      }

      exportData.websitePages.forEach(item => {
        const folderId = ((item as any) as Record<string, unknown>).folderId as string | undefined;
        if (folderId && !folderIds.has(folderId)) {
          errors.push({
            type: 'missing_folder',
            code: ExportErrorCode.MISSING_DEPENDENCIES,
            severity: ValidationSeverity.ERROR,
            message: `Content item "${item.id}" references missing folder "${folderId}"`,
            details: {
              contentId: item.id,
              folderId: folderId
            },
            path: `contentItems.${item.id}`
          });
        }
      });
    }

    return errors;
  }

  /**
   * Detect circular dependencies using DFS with recursion stack
   */
  async detectCircularDependencies(exportData: StandardExport): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    this.visitedNodes.clear();
    this.recursionStack.clear();
    this.circularDependencies = [];

    const componentRelationships = ((exportData.metadata as any) as Record<string, unknown>)?.componentRelationships as ComponentRelationship[] | undefined;
    if (!componentRelationships || !Array.isArray(componentRelationships)) {
      return errors;
    }

    // Build adjacency list for dependency graph
    const graph = new Map<string, string[]>();
    componentRelationships.forEach((rel: ComponentRelationship) => {
      if (!graph.has(rel.componentId)) {
        graph.set(rel.componentId, []);
      }
      rel.dependencies.forEach(dep => {
        graph.get(rel.componentId)!.push(dep.targetId);
      });
    });

    // Run DFS on each unvisited node
    for (const [nodeId] of graph) {
      if (!this.visitedNodes.has(nodeId)) {
        const path: string[] = [];
        this.dfsDetectCycle(nodeId, graph, path);
      }
    }

    // Convert circular dependencies to errors
    this.circularDependencies.forEach(cycle => {
      errors.push({
        type: 'circular_dependency',
        code: ExportErrorCode.CIRCULAR_REFERENCE,
        severity: ValidationSeverity.ERROR,
        message: `Circular dependency detected: ${cycle.cycle.join(' → ')}`,
        details: {
          cycle: cycle.cycle,
          affectedComponents: cycle.affectedComponents
        },
        path: `components.${cycle.cycle[0]}`
      });
    });

    return errors;
  }

  /**
   * DFS helper for cycle detection
   */
  private dfsDetectCycle(
    nodeId: string,
    graph: Map<string, string[]>,
    path: string[]
  ): boolean {
    this.visitedNodes.add(nodeId);
    this.recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!this.visitedNodes.has(neighbor)) {
        if (this.dfsDetectCycle(neighbor, graph, path)) {
          return true;
        }
      } else if (this.recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStartIndex = path.indexOf(neighbor);
        const cycle = path.slice(cycleStartIndex);
        cycle.push(neighbor); // Complete the cycle
        
        this.circularDependencies.push({
          cycle,
          affectedComponents: [...cycle]
        });
        
        return true;
      }
    }

    path.pop();
    this.recursionStack.delete(nodeId);
    return false;
  }

  /**
   * Check data integrity and schema validation
   */
  async checkDataIntegrity(exportData: StandardExport): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check content items
    if (exportData.websitePages) {
      exportData.websitePages.forEach(item => {
        // Check required fields
        if (!item.id) {
          errors.push({
            type: 'data_integrity',
            code: ExportErrorCode.DATA_INTEGRITY_ERROR,
            severity: ValidationSeverity.ERROR,
            message: 'Content item missing required field: id',
            details: { item },
            path: 'contentItems'
          });
        }

        if (!item.contentTypeId) {
          errors.push({
            type: 'data_integrity',
            code: ExportErrorCode.DATA_INTEGRITY_ERROR,
            severity: ValidationSeverity.ERROR,
            message: `Content item "${item.id}" missing required field: contentTypeId`,
            details: { itemId: item.id },
            path: `contentItems.${item.id}`
          });
        }

        // Check for empty or invalid data
        if (item.content && typeof item.content === 'object') {
          if (Object.keys(item.content).length === 0) {
            warnings.push({
              type: 'data_integrity',
              code: ExportErrorCode.DATA_INTEGRITY_ERROR,
              severity: ValidationSeverity.WARNING,
              message: `Content item "${item.id}" has empty data object`,
              details: { itemId: item.id },
              path: `contentItems.${item.id}.data`
            } as ValidationWarning);
          }
        }
      });
    }

    // Check content types
    if (exportData.contentTypes) {
      exportData.contentTypes.forEach(type => {
        if (!type.id || !type.name) {
          errors.push({
            type: 'data_integrity',
            code: ExportErrorCode.DATA_INTEGRITY_ERROR,
            severity: ValidationSeverity.ERROR,
            message: `Content type missing required fields: ${!type.id ? 'id' : ''} ${!type.name ? 'name' : ''}`,
            details: { type },
            path: 'contentTypes'
          });
        }

        // Validate field definitions
        if (type.fields && Array.isArray(type.fields)) {
          type.fields.forEach((field, index) => {
            if (!field.name || !field.type) {
              warnings.push({
                type: 'data_integrity',
                code: ExportErrorCode.DATA_INTEGRITY_ERROR,
                severity: ValidationSeverity.WARNING,
                message: `Field ${index} in content type "${type.id}" missing required properties`,
                details: { typeId: type.id, field },
                path: `contentTypes.${type.id}.fields.${index}`
              } as ValidationWarning);
            }
          });
        }
      });
    }

    // Check components
    if (exportData.components) {
      exportData.components.forEach(comp => {
        if (!comp.id || !comp.type) {
          errors.push({
            type: 'data_integrity',
            code: ExportErrorCode.DATA_INTEGRITY_ERROR,
            severity: ValidationSeverity.ERROR,
            message: `Component missing required fields: ${!comp.id ? 'id' : ''} ${!comp.type ? 'type' : ''}`,
            details: { component: comp },
            path: 'components'
          });
        }
      });
    }

    // Validate folder structure integrity
    if (exportData.folders && exportData.folders.root) {
      exportData.folders.root.forEach((folder, index) => {
        this.validateFolderStructure(folder, errors, warnings, `folders.root[${index}]`);
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate folder structure integrity
   */
  private validateFolderStructure(
    folder: FolderNode,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    path = 'folderStructure'
  ): void {
    if (!folder.id || !folder.name) {
      errors.push({
        type: 'data_integrity',
        code: ExportErrorCode.INVALID_STRUCTURE,
        severity: ValidationSeverity.ERROR,
        message: `Folder missing required fields at path: ${path}`,
        details: { folder },
        path
      });
    }

    if (folder.children) {
      folder.children.forEach((child, index) => {
        this.validateFolderStructure(
          child,
          errors,
          warnings,
          `${path}.children.${index}`
        );
      });
    }
  }

  /**
   * Check reference resolution
   */
  async checkReferences(exportData: StandardExport): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Build reference maps
    const contentTypeMap = new Map<string, Record<string, unknown>>();
    const componentMap = new Map<string, Record<string, unknown>>();
    const contentMap = new Map<string, Record<string, unknown>>();

    if (exportData.contentTypes) {
      exportData.contentTypes.forEach(type => {
        contentTypeMap.set(type.id, type as any);
      });
    }

    if (exportData.components) {
      exportData.components.forEach(comp => {
        componentMap.set(comp.id, comp as any);
      });
    }

    if (exportData.websitePages) {
      exportData.websitePages.forEach(item => {
        contentMap.set(item.id, item as any);
      });
    }

    // Validate content item references
    if (exportData.websitePages) {
      exportData.websitePages.forEach(item => {
        // Check content type reference (using contentTypeId field)
        if (item.contentTypeId && !contentTypeMap.has(item.contentTypeId)) {
          errors.push({
            type: 'reference_resolution',
            code: ExportErrorCode.UNRESOLVED_REFERENCE,
            severity: ValidationSeverity.ERROR,
            message: `Content item "${item.id}" references non-existent content type "${item.contentTypeId}"`,
            details: {
              itemId: item.id,
              contentType: item.contentTypeId
            },
            path: `contentItems.${item.id}.contentType`
          });
        }

        // Check component references in content
        if (item.content && typeof item.content === 'object') {
          this.checkDataReferences(item.content, item.id, componentMap, contentMap, warnings);
        }
      });
    }

    return { errors, warnings };
  }

  /**
   * Recursively check references in data objects
   */
  private checkDataReferences(
    data: unknown,
    itemId: string,
    componentMap: Map<string, Record<string, unknown>>,
    contentMap: Map<string, Record<string, unknown>>,
    warnings: ValidationWarning[],
    path = ''
  ): void {
    if (!data || typeof data !== 'object') return;

    Object.entries(data).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;

      // Check for component references
      if (key === 'componentId' && typeof value === 'string') {
        if (!componentMap.has(value)) {
          warnings.push({
            type: 'reference_resolution',
            code: ExportErrorCode.UNRESOLVED_REFERENCE,
            severity: ValidationSeverity.WARNING,
            message: `Content item "${itemId}" references non-existent component "${value}"`,
            details: {
              itemId,
              componentId: value,
              path: currentPath
            },
            path: `contentItems.${itemId}.data.${currentPath}`
          } as ValidationWarning);
        }
      }

      // Check for content references
      if ((key === 'contentId' || key === 'referenceId') && typeof value === 'string') {
        if (!contentMap.has(value)) {
          warnings.push({
            type: 'reference_resolution',
            code: ExportErrorCode.UNRESOLVED_REFERENCE,
            severity: ValidationSeverity.WARNING,
            message: `Content item "${itemId}" references non-existent content "${value}"`,
            details: {
              itemId,
              referenceId: value,
              path: currentPath
            },
            path: `contentItems.${itemId}.data.${currentPath}`
          } as ValidationWarning);
        }
      }

      // Recursively check nested objects and arrays
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            this.checkDataReferences(
              item,
              itemId,
              componentMap,
              contentMap,
              warnings,
              `${currentPath}[${index}]`
            );
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        this.checkDataReferences(value, itemId, componentMap, contentMap, warnings, currentPath);
      }
    });
  }

  /**
   * Validate URL for security concerns
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Check for potentially dangerous protocols
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return false;
      }
      // Check for localhost/internal IPs (optional - depends on security requirements)
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        return false; // Reject internal URLs for security
      }
      return true;
    } catch {
      return false; // Invalid URL
    }
  }

  /**
   * Check for unresolved references
   */
  async checkUnresolvedReferences(exportData: StandardExport): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = [];
    
    // Check for external references
    if (exportData.metadata?.externalReferences) {
      exportData.metadata.externalReferences.forEach(ref => {
        // Validate URLs if present
        if (ref.url && !this.isValidUrl(ref.url)) {
          warnings.push({
            type: 'security_warning',
            code: ExportErrorCode.UNRESOLVED_REFERENCE,
            severity: ValidationSeverity.WARNING,
            message: `External reference contains potentially unsafe URL: ${ref.url}`,
            details: { ...ref, securityIssue: 'invalid_url' },
            path: 'metadata.externalReferences'
          } as ValidationWarning);
        } else {
          warnings.push({
            type: 'unresolved_reference',
            code: ExportErrorCode.UNRESOLVED_REFERENCE,
            severity: ValidationSeverity.WARNING,
            message: `Export contains external reference: ${ref.type} "${ref.id}"`,
            details: ref,
            path: 'metadata.externalReferences'
          } as ValidationWarning);
        }
      });
    }

    return warnings;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(
    exportData: StandardExport,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    info: ValidationInfo[]
  ): ValidationSummary {
    const contentItems = exportData.websitePages?.length || 0;
    const contentTypes = exportData.contentTypes?.length || 0;
    const components = exportData.components?.length || 0;
    const folders = this.countFolders(exportData.folders);

    // Estimate size (rough calculation)
    const estimatedSize = this.estimateExportSize(exportData);
    
    // Estimate time based on item count
    const totalItems = contentItems + contentTypes + components;
    const estimatedTime = Math.max(1, Math.ceil(totalItems / 100)); // 100 items per second estimate

    return {
      contentItems,
      contentTypes,
      components,
      folders,
      estimatedSize,
      estimatedTime,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length
    };
  }

  /**
   * Count folders recursively
   */
  private countFolders(folderHierarchy?: FolderHierarchy): number {
    if (!folderHierarchy) return 0;
    
    // If it's a FolderHierarchy, use the totalFolders property if available
    if (folderHierarchy && 'totalFolders' in folderHierarchy && typeof folderHierarchy.totalFolders === 'number') {
      return folderHierarchy.totalFolders;
    }
    
    // Otherwise count manually from the root nodes
    let count = 0;
    if (folderHierarchy && 'root' in folderHierarchy && Array.isArray(folderHierarchy.root)) {
      folderHierarchy.root.forEach((node: FolderNode) => {
        count += this.countFolderNode(node);
      });
    }
    return count;
  }
  
  /**
   * Count a single folder node and its children
   */
  private countFolderNode(node: FolderNode): number {
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        count += this.countFolderNode(child);
      });
    }
    return count;
  }

  /**
   * Collect folder IDs recursively
   */
  private collectFolderIds(folder: FolderNode, folderIds: Set<string>): void {
    folderIds.add(folder.id);
    if (folder.children) {
      folder.children.forEach(child => {
        this.collectFolderIds(child, folderIds);
      });
    }
  }

  /**
   * Estimate export size in bytes
   */
  private estimateExportSize(exportData: StandardExport): number {
    try {
      // Rough JSON stringification to estimate size
      const jsonString = JSON.stringify(exportData);
      return jsonString.length;
    } catch {
      // Fallback estimation based on counts
      const items = (exportData.websitePages?.length || 0) * 1000; // 1KB per item
      const types = (exportData.contentTypes?.length || 0) * 500; // 500B per type
      const components = (exportData.components?.length || 0) * 800; // 800B per component
      return items + types + components;
    }
  }
}