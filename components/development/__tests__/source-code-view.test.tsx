import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SourceCodeView } from '@/components/development/source-code-view';
import { FileNode } from '@/components/development/file-tree';

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => {
  return {
    __esModule: true,
    default: ({ value, onChange }: { value: string; onChange?: (value: string | undefined) => void }) => (
      <div data-testid="monaco-editor">
        <div data-testid="editor-content">{value}</div>
        {onChange && (
          <button 
            data-testid="editor-change-button"
            onClick={() => onChange('changed content')}
          >
            Change
          </button>
        )}
      </div>
    ),
  };
});

// Mock CodeEditor component to render file content directly
jest.mock('@/components/development/code-editor', () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <div data-testid="code-editor">
      <pre data-testid="file-content">{value}</pre>
    </div>
  ),
}));

// Mock window.confirm for tab closing tests
const mockConfirm = jest.fn(() => true);
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: mockConfirm,
});

const mockFiles: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    path: '/src',
    children: [
      {
        id: '2',
        name: 'index.ts',
        type: 'file',
        path: '/src/index.ts',
        extension: 'ts',
      },
      {
        id: '3',
        name: 'app.tsx',
        type: 'file',
        path: '/src/app.tsx',
        extension: 'tsx',
      },
    ],
  },
  {
    id: '4',
    name: 'package.json',
    type: 'file',
    path: '/package.json',
    extension: 'json',
  },
];

describe('SourceCodeView Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getBoundingClientRect for resize tests
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      width: 800,
      height: 600,
      toJSON: () => {},
    }));
  });

  it('should render file tree and editor area', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Explorer')).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    expect(screen.getByText('No file open')).toBeInTheDocument();
  });

  it('should open file when clicked in file tree', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Click to expand the src folder
    await act(async () => {
      fireEvent.click(screen.getByText('src'));
    });
    
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Click on the file to open it
    await act(async () => {
      fireEvent.click(screen.getByText('index.ts'));
    });

    // Wait for file to be opened and content to be rendered
    await waitFor(() => {
      expect(screen.queryByText('No file open')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Check that the file content is displayed
    await waitFor(() => {
      const fileContent = screen.getByTestId('file-content');
      expect(fileContent).toBeInTheDocument();
      expect(fileContent.textContent).toContain('File: /src/index.ts');
    }, { timeout: 2000 });
  });

  it('should display tabs for open files', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand folder and open first file
    await act(async () => {
      fireEvent.click(screen.getByText('src'));
    });
    
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 2000 });

    await act(async () => {
      fireEvent.click(screen.getByText('index.ts'));
    });

    // Wait for tabs to appear
    await waitFor(() => {
      const tabs = screen.getByRole('tablist');
      expect(tabs).toBeInTheDocument();
    }, { timeout: 2000 });

    await waitFor(() => {
      const indexTab = screen.getByRole('tab', { name: /index.ts/ });
      expect(indexTab).toBeInTheDocument();
      expect(indexTab).toHaveAttribute('aria-selected', 'true');
    }, { timeout: 2000 });

    // Open second file
    await act(async () => {
      fireEvent.click(screen.getByText('app.tsx'));
    });

    await waitFor(() => {
      const appTab = screen.getByRole('tab', { name: /app.tsx/ });
      expect(appTab).toBeInTheDocument();
      expect(appTab).toHaveAttribute('aria-selected', 'true');
    }, { timeout: 2000 });
  });

  it('should switch between open files using tabs', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand folder and open files
    await act(async () => {
      fireEvent.click(screen.getByText('src'));
    });
    
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 2000 });

    await act(async () => {
      fireEvent.click(screen.getByText('index.ts'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('app.tsx'));
    });

    // Verify app.tsx is active
    await waitFor(() => {
      const fileContent = screen.getByTestId('file-content');
      expect(fileContent).toBeInTheDocument();
      expect(fileContent.textContent).toContain('File: /src/app.tsx');
    }, { timeout: 2000 });

    // Click on index.ts tab to switch
    await waitFor(() => {
      const indexTab = screen.getByRole('tab', { name: /index.ts/ });
      expect(indexTab).toBeInTheDocument();
    }, { timeout: 2000 });

    const indexTab = screen.getByRole('tab', { name: /index.ts/ });
    await act(async () => {
      fireEvent.click(indexTab);
    });

    await waitFor(() => {
      const fileContent = screen.getByTestId('file-content');
      expect(fileContent).toBeInTheDocument();
      expect(fileContent.textContent).toContain('File: /src/index.ts');
    }, { timeout: 2000 });
  });

  it('should close files when close button is clicked', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    // Open the file
    await act(async () => {
      fireEvent.click(screen.getByText('package.json'));
    });

    // Wait for tab to appear
    await waitFor(() => {
      const tab = screen.getByRole('tab', { name: /package.json/ });
      expect(tab).toBeInTheDocument();
    }, { timeout: 2000 });

    // Find and click the close button
    await waitFor(() => {
      const closeButton = screen.getByLabelText('Close package.json');
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 2000 });

    const closeButton = screen.getByLabelText('Close package.json');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    // Verify tab is closed and no file is open
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /package.json/ })).not.toBeInTheDocument();
      expect(screen.getByText('No file open')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should resize sidebar when dragging divider', async () => {
    const { container } = render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Explorer')).toBeInTheDocument();
    });

    // Find the resizer element
    await waitFor(() => {
      const resizer = container.querySelector('.cursor-col-resize');
      expect(resizer).toBeInTheDocument();
    }, { timeout: 2000 });

    const resizer = container.querySelector('.cursor-col-resize');

    // Find sidebar and check initial width
    await waitFor(() => {
      const sidebar = container.querySelector('[style*="width"]');
      expect(sidebar).toBeInTheDocument();
      const initialWidth = sidebar?.getAttribute('style');
      expect(initialWidth).toContain('width: 250px');
    }, { timeout: 2000 });

    // Simulate drag event with proper sequence
    await act(async () => {
      // Start drag
      fireEvent.mouseDown(resizer!, { 
        clientX: 250, 
        preventDefault: jest.fn() 
      });
    });

    // Simulate mouse move
    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 300 });
    });

    // End drag
    await act(async () => {
      fireEvent.mouseUp(document);
    });

    // Check that width has changed
    await waitFor(() => {
      const updatedSidebar = container.querySelector('[style*="width"]');
      const updatedWidth = updatedSidebar?.getAttribute('style');
      expect(updatedWidth).toContain('width: 300px');
    }, { timeout: 2000 });
  });

  it('should show loading state initially', () => {
    render(<SourceCodeView initialFiles={mockFiles} />);
    
    expect(screen.getByText('Loading source code view...')).toBeInTheDocument();
  });

  it('should handle empty file tree', async () => {
    render(<SourceCodeView initialFiles={[]} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('No files to display')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should maintain file selection state in tree when switching tabs', async () => {
    const { container } = render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand folder and open files
    await act(async () => {
      fireEvent.click(screen.getByText('src'));
    });

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 2000 });

    await act(async () => {
      fireEvent.click(screen.getByText('index.ts'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('app.tsx'));
    });

    // Wait for tabs to be created
    await waitFor(() => {
      const indexTab = screen.getByRole('tab', { name: /index.ts/ });
      expect(indexTab).toBeInTheDocument();
    }, { timeout: 2000 });

    const indexTab = screen.getByRole('tab', { name: /index.ts/ });
    await act(async () => {
      fireEvent.click(indexTab);
    });

    // Check that the correct file is selected in tree
    await waitFor(() => {
      const selectedNode = container.querySelector('[aria-selected="true"]');
      expect(selectedNode).toHaveTextContent('index.ts');
    }, { timeout: 2000 });
  });

  it('should support keyboard shortcuts for tab navigation', async () => {
    render(<SourceCodeView initialFiles={mockFiles} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading source code view...')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
    });

    // Expand folder and open all files
    await act(async () => {
      fireEvent.click(screen.getByText('src'));
    });

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 2000 });

    await act(async () => {
      fireEvent.click(screen.getByText('index.ts'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('app.tsx'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('package.json'));
    });

    // Wait for all tabs to be created
    await waitFor(() => {
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    }, { timeout: 2000 });

    // Verify package.json is currently selected
    await waitFor(() => {
      const packageTab = screen.getByRole('tab', { name: /package.json/ });
      expect(packageTab).toHaveAttribute('aria-selected', 'true');
    }, { timeout: 2000 });

    // Test keyboard shortcut (Ctrl+Tab)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true });
    });

    // Wait for tab change - should cycle to index.ts (first tab)
    await waitFor(() => {
      const indexTab = screen.getByRole('tab', { name: /index.ts/ });
      expect(indexTab).toHaveAttribute('aria-selected', 'true');
    }, { timeout: 2000 });
  });
});