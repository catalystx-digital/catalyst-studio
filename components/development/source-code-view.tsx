'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileTree, FileNode } from './file-tree';
import { EditorTabs } from './editor-tabs';
import { CodeEditor } from './code-editor';
import { SourceCodeProvider, useSourceCode } from './source-code-context';
import { cn } from '@/lib/utils';

interface SourceCodeViewProps {
  initialFiles?: FileNode[];
  className?: string;
}

function SourceCodeViewContent({ initialFiles = [], className }: SourceCodeViewProps) {
  const {
    openFiles,
    activeFileId,
    fileContents,
    selectedFileInTree,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    markFileDirty,
  } = useSourceCode();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [files] = useState<FileNode[]>(initialFiles);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback((file: FileNode) => {
    if (file.type === 'file') {
      const mockContent = `// File: ${file.path}\n\nconst example = "This is sample code";\n\nexport default example;`;
      const language = file.extension || 'plaintext';
      openFile(file, mockContent, language);
    }
  }, [openFile]);

  const handleContentChange = useCallback((fileId: string, newContent: string | undefined) => {
    if (newContent !== undefined) {
      updateFileContent(fileId, newContent);
      markFileDirty(fileId, true);
    }
  }, [updateFileContent, markFileDirty]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    
    const minWidth = 150;
    const maxWidth = containerRect.width * 0.5;
    
    setSidebarWidth(Math.max(minWidth, Math.min(newWidth, maxWidth)));
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const activeFileContent = activeFileId ? fileContents.get(activeFileId) : null;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex h-full bg-zinc-950 rounded-lg overflow-hidden",
        "border border-white/10",
        className
      )}
    >
      <div 
        className="flex-shrink-0 border-r border-white/10 overflow-hidden"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center px-4 py-2 border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm">
            <h3 className="text-sm font-medium text-gray-300">Explorer</h3>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <FileTree
              files={files}
              selectedFile={selectedFileInTree || undefined}
              onFileSelect={handleFileSelect}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "w-1 hover:bg-orange-500/50 transition-colors cursor-col-resize",
          "relative group",
          isResizing && "bg-orange-500/50"
        )}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-orange-500/20" />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <EditorTabs
          tabs={openFiles}
          activeTabId={activeFileId || undefined}
          onTabSelect={setActiveFile}
          onTabClose={closeFile}
        />
        
        <div className="flex-1 overflow-hidden">
          {activeFileContent ? (
            <CodeEditor
              key={activeFileId}
              value={activeFileContent.content}
              language={activeFileContent.language}
              onChange={(value) => handleContentChange(activeFileId!, value)}
              height="100%"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No file open</p>
                <p className="text-sm">Select a file from the explorer to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SourceCodeView(props: SourceCodeViewProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full",
        "bg-zinc-950 rounded-lg border border-white/10",
        props.className
      )}>
        <div className="text-gray-400">Loading source code view...</div>
      </div>
    );
  }

  return (
    <SourceCodeProvider>
      <SourceCodeViewContent {...props} />
    </SourceCodeProvider>
  );
}
