import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioPreviewPage from '../page';

const replace = jest.fn();
let currentSearchParams = new URLSearchParams('websiteId=site-1');

jest.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({ replace }),
  usePathname: () => '/studio/preview',
}));

jest.mock('@/lib/studio/components/preview/SandboxPreview', () => ({
  SandboxPreview: (props: { websiteId: string; designConcept?: string }) => (
    <div data-testid="sandbox-preview">
      Sandbox preview for {props.websiteId}
      {props.designConcept ? ` (${props.designConcept})` : ''}
    </div>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select
      aria-label="Design concept"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockFetch = (response: Partial<Response>) => {
  global.fetch = jest.fn().mockResolvedValue(response) as jest.Mock;
};

const flushConceptFetch = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('StudioPreviewPage', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams('websiteId=site-1');
    replace.mockClear();
    localStorage.clear();
    mockFetch({
      ok: true,
      json: async () => ({ concepts: [] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a scoped concepts error in the local preview header when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network unavailable')) as jest.Mock;

    render(<StudioPreviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Design concepts unavailable: network unavailable'
    );
    expect(screen.getByText('Local Preview')).toBeInTheDocument();
  });

  it('shows a scoped concepts error in the sandbox header for non-OK responses', async () => {
    currentSearchParams = new URLSearchParams('websiteId=site-1&sandbox=true');
    mockFetch({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    });

    render(<StudioPreviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Design concepts unavailable: Request failed with 500 Server Error'
    );
    expect(screen.getByTestId('sandbox-preview')).toBeInTheDocument();
  });

  it('shows a visible concepts error when the response JSON is bad', async () => {
    mockFetch({
      ok: true,
      json: async () => {
        throw new Error('Unexpected token');
      },
    });

    render(<StudioPreviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Design concepts unavailable: Unexpected token'
    );
  });

  it('updates the URL when a design concept is selected', async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        concepts: [
          { id: 'concept-default', name: 'Default', slug: 'default', isDefault: true },
          { id: 'concept-modern', name: 'Modern', slug: 'modern', isDefault: false },
        ],
      }),
    });

    render(<StudioPreviewPage />);
    await flushConceptFetch();

    const selector = screen.getByLabelText('Design concept');
    fireEvent.change(selector, { target: { value: 'modern' } });
    await flushConceptFetch();

    expect(replace).toHaveBeenCalledWith('/studio/preview?websiteId=site-1&designConcept=modern');
  });

  it('remounts the iframe and resets loading when the preview URL changes', async () => {
    const { rerender } = render(<StudioPreviewPage />);
    await flushConceptFetch();

    const initialIframe = await screen.findByTitle('Website Preview');
    fireEvent.load(initialIframe);

    await waitFor(() => {
      expect(screen.queryByText('Loading local preview...')).not.toBeInTheDocument();
    });

    currentSearchParams = new URLSearchParams('websiteId=site-1&path=/about');
    rerender(<StudioPreviewPage />);

    const nextIframe = screen.getByTitle('Website Preview');
    expect(nextIframe).not.toBe(initialIframe);
    expect(nextIframe).toHaveAttribute('src', '/studio/preview/site/site-1/about');
    expect(screen.getByText('Loading local preview...')).toBeInTheDocument();
  });

  it('clears the loading overlay when the iframe loads', async () => {
    render(<StudioPreviewPage />);
    await flushConceptFetch();

    fireEvent.load(await screen.findByTitle('Website Preview'));
    await waitFor(() => {
      expect(screen.queryByText('Loading local preview...')).not.toBeInTheDocument();
    });
  });
});
