'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import { EditorErrorBoundary } from './editor-error-boundary';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">Loading editor...</div>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
}

const CATALYST_DARK_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
    { token: 'keyword', foreground: '0077CC' },
    { token: 'string', foreground: '00AA55' },
    { token: 'number', foreground: 'FF5500' },
    { token: 'type', foreground: '0077CC' },
    { token: 'function', foreground: 'FF5500' },
    { token: 'variable', foreground: 'E1E4E8' },
    { token: 'constant', foreground: 'FF5500' },
    { token: 'parameter', foreground: 'E1E4E8' },
    { token: 'property', foreground: '0077CC' },
    { token: 'punctuation', foreground: 'E1E4E8' },
    { token: 'operator', foreground: '0077CC' },
    { token: 'namespace', foreground: '00AA55' },
  ],
  colors: {
    'editor.background': '#1a1a1a',
    'editor.foreground': '#E1E4E8',
    'editor.lineHighlightBackground': '#212121',
    'editor.selectionBackground': '#FF550033',
    'editor.inactiveSelectionBackground': '#FF550022',
    'editorCursor.foreground': '#FF5500',
    'editorIndentGuide.background': '#2D2D2D',
    'editorIndentGuide.activeBackground': '#FF5500',
    'editorLineNumber.foreground': '#6A737D',
    'editorLineNumber.activeForeground': '#FF5500',
    'editor.findMatchBackground': '#FF550044',
    'editor.findMatchHighlightBackground': '#FF550022',
    'editorBracketMatch.background': '#0077CC33',
    'editorBracketMatch.border': '#0077CC',
    'scrollbar.shadow': '#00000033',
    'scrollbarSlider.background': '#6A737D33',
    'scrollbarSlider.hoverBackground': '#6A737D44',
    'scrollbarSlider.activeBackground': '#6A737D66',
  },
};

export function CodeEditor({
  value,
  onChange,
  language = 'typescript',
  readOnly = false,
  height = '100%',
  className = '',
}: CodeEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorWillMount = (monaco: Monaco) => {
    monacoRef.current = monaco;
    
    monaco.editor.defineTheme('catalyst-dark', CATALYST_DARK_THEME);
    
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    });
  };

  return (
    <EditorErrorBoundary>
      <div className={`w-full h-full ${className}`} data-testid="monaco-editor">
        <MonacoEditor
          height={height}
          language={language}
          value={value}
          onChange={onChange}
          theme="catalyst-dark"
          beforeMount={handleEditorWillMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 5,
            lineNumbersMinChars: 4,
            renderLineHighlight: 'all',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'off',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: {
              top: 16,
              bottom: 16,
            },
          }}
        />
      </div>
    </EditorErrorBoundary>
  );
}