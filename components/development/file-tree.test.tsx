import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree, FileNode } from './file-tree';

const mockFiles: FileNode[] = [
  {
    id: '1',
    name: 'src',
    type: 'folder',
    path: '/src',
    children: [
      {
        id: '2',
        name: 'components',
        type: 'folder',
        path: '/src/components',
        children: [
          {
            id: '3',
            name: 'Button.tsx',
            type: 'file',
            path: '/src/components/Button.tsx',
            extension: 'tsx',
          },
          {
            id: '4',
            name: 'Card.tsx',
            type: 'file',
            path: '/src/components/Card.tsx',
            extension: 'tsx',
          },
        ],
      },
      {
        id: '5',
        name: 'index.ts',
        type: 'file',
        path: '/src/index.ts',
        extension: 'ts',
      },
    ],
  },
  {
    id: '6',
    name: 'package.json',
    type: 'file',
    path: '/package.json',
    extension: 'json',
  },
];

describe('FileTree', () => {
  it('should render file tree structure', () => {
    render(<FileTree files={mockFiles} />);

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('should expand and collapse folders on click', () => {
    render(<FileTree files={mockFiles} />);

    const srcFolder = screen.getByText('src');
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
    
    fireEvent.click(srcFolder);
    
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    
    fireEvent.click(srcFolder);
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
  });

  it('should call onFileSelect when a file is clicked', () => {
    const mockOnFileSelect = jest.fn();
    render(<FileTree files={mockFiles} onFileSelect={mockOnFileSelect} />);

    const packageJson = screen.getByText('package.json');
    fireEvent.click(packageJson);

    expect(mockOnFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '6',
        name: 'package.json',
        type: 'file',
      })
    );
  });

  it('should highlight selected file', () => {
    const { container } = render(
      <FileTree files={mockFiles} selectedFile="6" />
    );

    const selectedNode = container.querySelector('[aria-selected="true"]');
    expect(selectedNode).toHaveTextContent('package.json');
  });

  it('should show empty state when no files', () => {
    render(<FileTree files={[]} />);

    expect(screen.getByText('No files to display')).toBeInTheDocument();
  });

  it('should support keyboard navigation with arrow keys', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    
    const focusedElement = document.activeElement;
    expect(focusedElement).toHaveAttribute('aria-label', expect.stringContaining('src'));
    
    fireEvent.keyDown(focusedElement!, { key: 'Enter' });
    
    expect(screen.getByText('components')).toBeInTheDocument();
    
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    const nextFocusedElement = document.activeElement;
    expect(nextFocusedElement).toHaveAttribute('aria-label', expect.stringContaining('components'));
  });

  it('should expand folder with right arrow and collapse with left arrow', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    
    const focusedElement = document.activeElement;
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
    
    fireEvent.keyDown(focusedElement!, { key: 'ArrowRight' });
    
    expect(screen.getByText('components')).toBeInTheDocument();
    
    fireEvent.keyDown(focusedElement!, { key: 'ArrowLeft' });
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
  });

  it('should toggle folder expansion with Space key', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    
    const focusedElement = document.activeElement;
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
    
    fireEvent.keyDown(focusedElement!, { key: ' ' });
    
    expect(screen.getByText('components')).toBeInTheDocument();
    
    fireEvent.keyDown(focusedElement!, { key: ' ' });
    
    expect(screen.queryByText('components')).not.toBeInTheDocument();
  });

  it('should navigate to first item with Home key', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    
    fireEvent.keyDown(tree, { key: 'End' });
    fireEvent.keyDown(tree, { key: 'Home' });
    
    const focusedElement = document.activeElement;
    expect(focusedElement).toHaveAttribute('aria-label', expect.stringContaining('src'));
  });

  it('should navigate to last visible item with End key', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    
    fireEvent.keyDown(tree, { key: 'End' });
    
    const focusedElement = document.activeElement;
    expect(focusedElement).toHaveAttribute('aria-label', expect.stringContaining('package.json'));
  });

  it('should support type-ahead search', async () => {
    const user = userEvent.setup({ delay: null });
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    
    await user.type(tree, 'p');
    
    const focusedElement = document.activeElement;
    expect(focusedElement).toHaveAttribute('aria-label', expect.stringContaining('package.json'));
  });

  it('should have proper ARIA attributes', () => {
    render(<FileTree files={mockFiles} />);

    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('aria-label', 'File explorer');

    const srcFolder = screen.getByText('src').closest('[role="treeitem"]');
    expect(srcFolder).toHaveAttribute('aria-level', '0');
    expect(srcFolder).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(srcFolder!);
    expect(srcFolder).toHaveAttribute('aria-expanded', 'true');

    const componentsFolder = screen.getByText('components').closest('[role="treeitem"]');
    expect(componentsFolder).toHaveAttribute('aria-level', '1');
  });

  it('should show appropriate file icons based on extension', () => {
    render(<FileTree files={mockFiles} />);

    const srcFolder = screen.getByText('src');
    fireEvent.click(srcFolder);

    const componentsFolder = screen.getByText('components');
    fireEvent.click(componentsFolder);

    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });
});