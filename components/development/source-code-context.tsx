'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FileNode } from './file-tree';

interface FileContent {
  id: string;
  content: string;
  language: string;
}

interface EditorTab {
  id: string;
  name: string;
  path: string;
  extension?: string;
  isDirty?: boolean;
}

interface SourceCodeState {
  openFiles: EditorTab[];
  activeFileId: string | null;
  fileContents: Map<string, FileContent>;
  selectedFileInTree: string | null;
}

interface SourceCodeContextValue extends SourceCodeState {
  openFile: (file: FileNode, content: string, language: string) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  markFileDirty: (fileId: string, isDirty: boolean) => void;
  selectFileInTree: (fileId: string) => void;
}

const SourceCodeContext = createContext<SourceCodeContextValue | undefined>(undefined);

export function useSourceCode() {
  const context = useContext(SourceCodeContext);
  if (!context) {
    throw new Error('useSourceCode must be used within a SourceCodeProvider');
  }
  return context;
}

interface SourceCodeProviderProps {
  children: ReactNode;
}

export function SourceCodeProvider({ children }: SourceCodeProviderProps) {
  const [state, setState] = useState<SourceCodeState>({
    openFiles: [],
    activeFileId: null,
    fileContents: new Map(),
    selectedFileInTree: null,
  });

  const openFile = useCallback((file: FileNode, content: string, language: string) => {
    setState(prev => {
      const existingTab = prev.openFiles.find(tab => tab.id === file.id);
      
      if (existingTab) {
        return {
          ...prev,
          activeFileId: file.id,
          selectedFileInTree: file.id,
        };
      }

      const newTab: EditorTab = {
        id: file.id,
        name: file.name,
        path: file.path,
        extension: file.extension,
        isDirty: false,
      };

      const newFileContent: FileContent = {
        id: file.id,
        content,
        language,
      };

      const newFileContents = new Map(prev.fileContents);
      newFileContents.set(file.id, newFileContent);

      return {
        ...prev,
        openFiles: [...prev.openFiles, newTab],
        activeFileId: file.id,
        fileContents: newFileContents,
        selectedFileInTree: file.id,
      };
    });
  }, []);

  const closeFile = useCallback((fileId: string) => {
    setState(prev => {
      const fileIndex = prev.openFiles.findIndex(tab => tab.id === fileId);
      if (fileIndex === -1) return prev;

      const newOpenFiles = prev.openFiles.filter(tab => tab.id !== fileId);
      const newFileContents = new Map(prev.fileContents);
      newFileContents.delete(fileId);

      let newActiveFileId = prev.activeFileId;
      if (prev.activeFileId === fileId) {
        if (newOpenFiles.length > 0) {
          const newActiveIndex = Math.min(fileIndex, newOpenFiles.length - 1);
          newActiveFileId = newOpenFiles[newActiveIndex].id;
        } else {
          newActiveFileId = null;
        }
      }

      return {
        ...prev,
        openFiles: newOpenFiles,
        activeFileId: newActiveFileId,
        fileContents: newFileContents,
      };
    });
  }, []);

  const setActiveFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      activeFileId: fileId,
      selectedFileInTree: fileId,
    }));
  }, []);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setState(prev => {
      const fileContent = prev.fileContents.get(fileId);
      if (!fileContent) return prev;

      const newFileContents = new Map(prev.fileContents);
      newFileContents.set(fileId, { ...fileContent, content });

      return {
        ...prev,
        fileContents: newFileContents,
      };
    });
  }, []);

  const markFileDirty = useCallback((fileId: string, isDirty: boolean) => {
    setState(prev => ({
      ...prev,
      openFiles: prev.openFiles.map(tab =>
        tab.id === fileId ? { ...tab, isDirty } : tab
      ),
    }));
  }, []);

  const selectFileInTree = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      selectedFileInTree: fileId,
    }));
  }, []);

  const value: SourceCodeContextValue = {
    ...state,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
    markFileDirty,
    selectFileInTree,
  };

  return (
    <SourceCodeContext.Provider value={value}>
      {children}
    </SourceCodeContext.Provider>
  );
}