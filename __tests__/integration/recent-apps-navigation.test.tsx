import React from 'react';
import { render, screen, fireEvent, waitFor, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { RecentApps } from '@/components/dashboard/recent-apps';
import { useWebsites } from '@/lib/api/hooks/use-websites';
import { useImportActivity } from '@/lib/api/hooks/use-import-activity';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockDeleteWebsiteMutation = {
  mutateAsync: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  error: null,
};

jest.mock('@/lib/api/hooks/use-websites', () => ({
  useWebsites: jest.fn(),
  useDeleteWebsite: jest.fn(() => mockDeleteWebsiteMutation),
}));
jest.mock('@/lib/api/hooks/use-import-activity', () => ({
  useImportActivity: jest.fn(),
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago'),
}));

const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseWebsites = useWebsites as jest.MockedFunction<typeof useWebsites>;
const mockedUseImportActivity = useImportActivity as jest.MockedFunction<typeof useImportActivity>;

type RenderWithClientResult = RenderResult & { queryClient: QueryClient };

function renderWithClient(ui: React.ReactNode, client?: QueryClient): RenderWithClientResult {
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchInterval: false,
        },
      },
    });

  const renderResult = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  ) as RenderResult;

  return Object.assign(renderResult, { queryClient });
}

describe('RecentApps integration', () => {
  const mockPush = jest.fn();
  const now = new Date().toISOString();
  let mockWebsitesRefetch: jest.Mock;
  let mockImportRefetch: jest.Mock;

  beforeEach(() => {
    mockedUseRouter.mockReset();
    mockedUseWebsites.mockReset();
    mockedUseImportActivity.mockReset();

    mockDeleteWebsiteMutation.mutateAsync.mockReset();
    mockDeleteWebsiteMutation.reset.mockReset();
    mockDeleteWebsiteMutation.isPending = false;
    mockDeleteWebsiteMutation.error = null;

    mockWebsitesRefetch = jest.fn().mockResolvedValue(undefined);
    mockImportRefetch = jest.fn().mockResolvedValue(undefined);

    mockedUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockImportRefetch,
    } as any);
  });

  it('navigates to the studio route when a card is clicked', async () => {
    mockedUseWebsites.mockReturnValue({
      data: [
        {
          id: 'alpha',
          name: 'Alpha Site',
          description: 'Alpha description',
          category: 'portfolio',
          icon: null,
          metadata: {},
          settings: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    renderWithClient(<RecentApps />);

    await waitFor(() => expect(screen.getByText('Alpha Site')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Alpha Site').closest('button')!);

    expect(mockPush).toHaveBeenCalledWith('/studio/site-builder?websiteId=alpha');
  });

  it('supports showing all websites when View All is triggered', async () => {
    mockedUseWebsites.mockReturnValue({
      data: Array.from({ length: 18 }, (_, i) => ({
        id: `site-${i}`,
        name: `Website ${i}`,
        description: `Description ${i}`,
        category: 'blog',
        icon: null,
        metadata: {},
        settings: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    renderWithClient(<RecentApps maxItems={12} />);

    await waitFor(() => expect(screen.getByText('View All (18)')).toBeInTheDocument());

    fireEvent.click(screen.getByText('View All (18)'));

    await waitFor(() => {
      const cards = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('Website'));
      expect(cards).toHaveLength(18);
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });
  });

  it('reflects updated website list on rerender', async () => {
    const firstSet = [
      {
        id: 'one',
        name: 'First Website',
        description: 'Initial',
        category: 'blog',
        icon: null,
        metadata: {},
        settings: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    mockedUseWebsites.mockReturnValue({
      data: firstSet,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    const { rerender, queryClient } = renderWithClient(<RecentApps />);

    await waitFor(() => expect(screen.getByText('First Website')).toBeInTheDocument());

    const secondSet = [
      ...firstSet,
      {
        id: 'two',
        name: 'Second Website',
        description: 'New',
        category: 'portfolio',
        icon: null,
        metadata: {},
        settings: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    mockedUseWebsites.mockReturnValue({
      data: secondSet,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    rerender(
      <QueryClientProvider client={queryClient}>
        <RecentApps />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Second Website')).toBeInTheDocument();
    });
  });
});
