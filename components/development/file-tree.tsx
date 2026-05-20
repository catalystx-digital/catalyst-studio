'use client';

import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  path: string;
  extension?: string;
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile?: string;
  onFileSelect?: (file: FileNode) => void;
  className?: string;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  selectedFile?: string;
  onFileSelect?: (file: FileNode) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (folderId: string) => void;
  focusedNodeId: string | null;
  onFocusNode: (nodeId: string) => void;
  onAnnounce?: (message: string) => void;
}

const getFileIcon = (extension?: string) => {
  const iconClass = "w-4 h-4";
  
  switch (extension) {
    case 'ts':
    case 'tsx':
      return <File className={cn(iconClass, "text-blue-400")} />;
    case 'js':
    case 'jsx':
      return <File className={cn(iconClass, "text-yellow-400")} />;
    case 'css':
    case 'scss':
      return <File className={cn(iconClass, "text-purple-400")} />;
    case 'json':
      return <File className={cn(iconClass, "text-orange-400")} />;
    case 'md':
      return <File className={cn(iconClass, "text-gray-400")} />;
    default:
      return <File className={cn(iconClass, "text-gray-300")} />;
  }
};

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedFile,
  onFileSelect,
  expandedFolders,
  onToggleFolder,
  focusedNodeId,
  onFocusNode,
  onAnnounce,
}) => {
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFile === node.id;
  const isFocused = focusedNodeId === node.id;
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.focus();
    }
  }, [isFocused]);

  const handleClick = useCallback(() => {
    if (node.type === 'folder') {
      onToggleFolder(node.id);
    } else {
      onFileSelect?.(node);
      onAnnounce?.(`Selected file: ${node.name}`);
    }
    onFocusNode(node.id);
  }, [node, onToggleFolder, onFileSelect, onFocusNode, onAnnounce]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    switch (e.key) {
      case 'Enter':
        if (node.type === 'file') {
          onFileSelect?.(node);
        } else {
          onToggleFolder(node.id);
        }
        break;
      case ' ':
        e.preventDefault();
        if (node.type === 'folder') {
          onToggleFolder(node.id);
        }
        break;
      case 'ArrowRight':
        if (node.type === 'folder' && !isExpanded) {
          onToggleFolder(node.id);
        }
        break;
      case 'ArrowLeft':
        if (node.type === 'folder' && isExpanded) {
          onToggleFolder(node.id);
        }
        break;
    }
  }, [node, isExpanded, onToggleFolder, onFileSelect]);

  return (
    <>
      <div
        ref={nodeRef}
        role="treeitem"
        aria-expanded={node.type === 'folder' ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-level={level}
        aria-label={`${node.type === 'folder' ? 'Folder' : 'File'}: ${node.name}`}
        aria-setsize={node.children?.length || 0}
        aria-posinset={level + 1}
        tabIndex={isFocused ? 0 : -1}
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-white/5 rounded transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-white/5",
          isSelected && "bg-orange-500/20 hover:bg-orange-500/25",
          "select-none"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {node.type === 'folder' && (
          <span className="transition-transform" aria-hidden="true">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </span>
        )}
        
        <span className="flex-shrink-0" aria-hidden="true">
          {node.type === 'folder' ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-orange-400" />
            ) : (
              <Folder className="w-4 h-4 text-orange-400" />
            )
          ) : (
            getFileIcon(node.extension)
          )}
        </span>
        
        <span className={cn(
          "text-sm truncate",
          isSelected ? "text-white font-medium" : "text-gray-300"
        )}>
          {node.name}
        </span>
      </div>
      
      {node.type === 'folder' && isExpanded && node.children && (
        <div role="group" aria-label={`Contents of ${node.name}`}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              focusedNodeId={focusedNodeId}
              onFocusNode={onFocusNode}
              onAnnounce={onAnnounce}
            />
          ))}
        </div>
      )}
    </>
  );
};

export function FileTree({ 
  files, 
  selectedFile, 
  onFileSelect,
  className 
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const treeRef = useRef<HTMLDivElement>(null);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      const isExpanding = !next.has(folderId);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      
      // Announce folder state change to screen readers
      const folder = files.find(f => f.id === folderId);
      if (folder) {
        setAnnouncement(`${folder.name} folder ${isExpanding ? 'expanded' : 'collapsed'}`);
      }
      
      return next;
    });
  }, [files]);

  const findNextNode = useCallback((currentId: string | null, direction: 'up' | 'down'): string | null => {
    const allNodes: string[] = [];
    
    const collectNodes = (nodes: FileNode[]) => {
      for (const node of nodes) {
        allNodes.push(node.id);
        if (node.type === 'folder' && expandedFolders.has(node.id) && node.children) {
          collectNodes(node.children);
        }
      }
    };
    
    collectNodes(files);
    
    if (!currentId) {
      return allNodes.length > 0 ? allNodes[0] : null;
    }
    
    const currentIndex = allNodes.indexOf(currentId);
    if (currentIndex === -1) return null;
    
    const nextIndex = direction === 'down' 
      ? Math.min(currentIndex + 1, allNodes.length - 1)
      : Math.max(currentIndex - 1, 0);
    
    return allNodes[nextIndex];
  }, [files, expandedFolders]);

  const handleTreeKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextDown = findNextNode(focusedNodeId, 'down');
        if (nextDown) setFocusedNodeId(nextDown);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const nextUp = findNextNode(focusedNodeId, 'up');
        if (nextUp) setFocusedNodeId(nextUp);
        break;
      case 'Home':
        e.preventDefault();
        if (files.length > 0) setFocusedNodeId(files[0].id);
        break;
      case 'End':
        e.preventDefault();
        const allNodes: string[] = [];
        const collectAll = (nodes: FileNode[]) => {
          for (const node of nodes) {
            allNodes.push(node.id);
            if (node.type === 'folder' && expandedFolders.has(node.id) && node.children) {
              collectAll(node.children);
            }
          }
        };
        collectAll(files);
        if (allNodes.length > 0) {
          setFocusedNodeId(allNodes[allNodes.length - 1]);
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          setSearchQuery(prev => prev + e.key.toLowerCase());
          setTimeout(() => setSearchQuery(''), 1500);
        }
    }
  }, [focusedNodeId, findNextNode, files, expandedFolders]);

  useEffect(() => {
    if (searchQuery) {
      const findMatchingNode = (nodes: FileNode[]): string | null => {
        for (const node of nodes) {
          if (node.name.toLowerCase().startsWith(searchQuery)) {
            return node.id;
          }
          if (node.type === 'folder' && node.children) {
            const match = findMatchingNode(node.children);
            if (match) return match;
          }
        }
        return null;
      };
      
      const match = findMatchingNode(files);
      if (match) {
        setFocusedNodeId(match);
      }
    }
  }, [searchQuery, files]);

  return (
    <>
      <div 
        ref={treeRef}
        role="tree"
        aria-label="File explorer"
        aria-multiselectable="false"
        aria-activedescendant={focusedNodeId || undefined}
        className={cn(
          "bg-zinc-900/50 backdrop-blur-sm rounded-lg border border-white/10",
          "overflow-auto",
          className
        )}
        onKeyDown={handleTreeKeyDown}
      >
        <div className="p-2">
          {files.length === 0 ? (
            <div className="text-gray-500 text-sm p-4 text-center">
              No files to display
            </div>
          ) : (
            files.map((file) => (
              <TreeNode
                key={file.id}
                node={file}
                level={0}
                selectedFile={selectedFile}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                focusedNodeId={focusedNodeId}
                onFocusNode={setFocusedNodeId}
                onAnnounce={setAnnouncement}
              />
            ))
          )}
        </div>
      </div>
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
        role="status"
      >
        {announcement}
      </div>
    </>
  );
}