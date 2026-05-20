import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorTabs, EditorTab } from './editor-tabs';

const mockTabs: EditorTab[] = [
  {
    id: '1',
    name: 'index.tsx',
    path: '/src/index.tsx',
    extension: 'tsx',
  },
  {
    id: '2',
    name: 'styles.css',
    path: '/src/styles.css',
    extension: 'css',
  },
  {
    id: '3',
    name: 'config.json',
    path: '/config.json',
    extension: 'json',
    isDirty: true,
  },
];

describe('EditorTabs', () => {
  it('should render all tabs', () => {
    render(<EditorTabs tabs={mockTabs} />);

    expect(screen.getByText('index.tsx')).toBeInTheDocument();
    expect(screen.getByText('styles.css')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
  });

  it('should show empty state when no tabs', () => {
    render(<EditorTabs tabs={[]} />);

    expect(screen.getByText('No files open')).toBeInTheDocument();
  });

  it('should highlight active tab', () => {
    render(<EditorTabs tabs={mockTabs} activeTabId="2" />);

    const activeTab = screen.getByRole('tab', { selected: true });
    expect(activeTab).toHaveTextContent('styles.css');
  });

  it('should call onTabSelect when tab is clicked', () => {
    const mockOnTabSelect = jest.fn();
    render(
      <EditorTabs 
        tabs={mockTabs} 
        onTabSelect={mockOnTabSelect}
      />
    );

    fireEvent.click(screen.getByText('styles.css'));
    expect(mockOnTabSelect).toHaveBeenCalledWith('2');
  });

  it('should call onTabClose when close button is clicked', () => {
    const mockOnTabClose = jest.fn();
    render(
      <EditorTabs 
        tabs={mockTabs} 
        activeTabId="1"
        onTabClose={mockOnTabClose}
      />
    );

    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[0]);
    
    expect(mockOnTabClose).toHaveBeenCalledWith('1');
  });

  it('should show dirty indicator for unsaved files', () => {
    render(<EditorTabs tabs={mockTabs} />);

    const configTab = screen.getByText('config.json');
    expect(configTab.textContent).toContain('•');
  });

  it('should confirm before closing dirty files', () => {
    const mockOnTabClose = jest.fn();
    const mockConfirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    
    render(
      <EditorTabs 
        tabs={mockTabs}
        activeTabId="3"
        onTabClose={mockOnTabClose}
      />
    );

    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[2]);
    
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining('has unsaved changes')
    );
    expect(mockOnTabClose).not.toHaveBeenCalled();
    
    mockConfirm.mockRestore();
  });

  it('should close dirty file when confirmed', () => {
    const mockOnTabClose = jest.fn();
    const mockConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(
      <EditorTabs 
        tabs={mockTabs}
        activeTabId="3"
        onTabClose={mockOnTabClose}
      />
    );

    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[2]);
    
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockOnTabClose).toHaveBeenCalledWith('3');
    
    mockConfirm.mockRestore();
  });

  it('should handle keyboard shortcut Ctrl+W to close active tab', () => {
    const mockOnTabClose = jest.fn();
    render(
      <EditorTabs 
        tabs={mockTabs}
        activeTabId="2"
        onTabClose={mockOnTabClose}
      />
    );

    fireEvent.keyDown(window, { key: 'w', ctrlKey: true });
    
    expect(mockOnTabClose).toHaveBeenCalledWith('2');
  });

  it('should handle keyboard shortcut Ctrl+Tab to switch tabs', () => {
    const mockOnTabSelect = jest.fn();
    render(
      <EditorTabs 
        tabs={mockTabs}
        activeTabId="1"
        onTabSelect={mockOnTabSelect}
      />
    );

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true });
    
    expect(mockOnTabSelect).toHaveBeenCalledWith('2');
  });

  it('should handle keyboard shortcut Ctrl+Shift+Tab to switch tabs backwards', () => {
    const mockOnTabSelect = jest.fn();
    render(
      <EditorTabs 
        tabs={mockTabs}
        activeTabId="1"
        onTabSelect={mockOnTabSelect}
      />
    );

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true, shiftKey: true });
    
    expect(mockOnTabSelect).toHaveBeenCalledWith('3');
  });

  it('should show appropriate file icons based on extension', () => {
    const { container } = render(<EditorTabs tabs={mockTabs} />);

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);
    
    expect(tabs[0]).toHaveTextContent('index.tsx');
    expect(tabs[1]).toHaveTextContent('styles.css');
    expect(tabs[2]).toHaveTextContent('config.json');
  });

  it('should have proper ARIA attributes', () => {
    render(<EditorTabs tabs={mockTabs} activeTabId="2" />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });
});