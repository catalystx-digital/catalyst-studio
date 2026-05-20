import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIPromptSection } from '../ai-prompt-section';

describe('AIPromptSection', () => {
  const mockOnWebsiteCreated = jest.fn();
  
  beforeEach(() => {
    mockOnWebsiteCreated.mockClear();
  });
  
  it('should render the main heading', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    expect(screen.getByText('What would you build today?')).toBeInTheDocument();
  });
  
  it('should render textarea with placeholder', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    expect(textarea).toBeInTheDocument();
  });
  
  it('should disable create button when prompt is empty', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const createButton = screen.getByRole('button', { name: /Create Website/i });
    expect(createButton).toBeDisabled();
  });
  
  it('should enable create button when prompt has content', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });
    
    await userEvent.type(textarea, 'A CRM for small businesses');
    
    expect(createButton).toBeEnabled();
  });
  
  it('should call onWebsiteCreated when create button is clicked', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });
    
    await userEvent.type(textarea, 'A CRM for small businesses');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockOnWebsiteCreated).toHaveBeenCalledWith('A CRM for small businesses');
    });
  });
  
  it('should show loading state when isCreating is true', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={true} 
      />
    );
    
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });
  
  it('should disable textarea when creating', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={true} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    expect(textarea).toBeDisabled();
  });
  
  it('should update prompt when category tag is clicked', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const crmTag = screen.getByText('CRM');
    fireEvent.click(crmTag);
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/) as HTMLTextAreaElement;
    
    await waitFor(() => {
      expect(textarea.value).toContain('customer relationship management');
    });
  });
  
  it('should handle Ctrl+Enter keyboard shortcut', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    
    await userEvent.type(textarea, 'Test prompt');
    
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    
    await waitFor(() => {
      expect(mockOnWebsiteCreated).toHaveBeenCalledWith('Test prompt');
    });
  });
  
  it('should handle Cmd+Enter keyboard shortcut on Mac', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    
    await userEvent.type(textarea, 'Test prompt');
    
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    
    await waitFor(() => {
      expect(mockOnWebsiteCreated).toHaveBeenCalledWith('Test prompt');
    });
  });
  
  it('should not submit on Enter without modifier key', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    
    await userEvent.type(textarea, 'Test prompt');
    
    fireEvent.keyDown(textarea, { key: 'Enter' });
    
    expect(mockOnWebsiteCreated).not.toHaveBeenCalled();
  });
  
  it('should clear prompt after successful creation', async () => {
    mockOnWebsiteCreated.mockResolvedValue(undefined);
    
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/) as HTMLTextAreaElement;
    const createButton = screen.getByRole('button', { name: /Create Website/i });
    
    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });
  
  it('should show keyboard shortcut hint', () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    expect(screen.getByText(/Ctrl/)).toBeInTheDocument();
    expect(screen.getByText(/Enter/)).toBeInTheDocument();
  });
  
  it('should auto-resize textarea based on content', async () => {
    const { container } = render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const initialHeight = textarea.style.height;
    
    // Type multiple lines
    await userEvent.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    
    // Height should have changed
    expect(textarea.style.height).not.toBe(initialHeight);
  });
  
  it('should not submit when prompt is only whitespace', async () => {
    render(
      <AIPromptSection 
        onWebsiteCreated={mockOnWebsiteCreated} 
        isCreating={false} 
      />
    );
    
    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });
    
    await userEvent.type(textarea, '   ');
    
    expect(createButton).toBeDisabled();
  });
});