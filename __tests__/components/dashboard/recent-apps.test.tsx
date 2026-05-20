import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { RecentApps } from '@/components/dashboard/recent-apps';
import { useWebsites } from '@/lib/api/hooks/use-websites';
import { useImportActivity } from '@/lib/api/hooks/use-import-activity';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import type { Website } from '@/types/api';

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

jest.mock('@/lib/config/deployment', () => ({
  getStudioWebsiteRoute: jest.fn(),
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago'),
}));

const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseWebsites = useWebsites as jest.MockedFunction<typeof useWebsites>;
const mockedUseImportActivity = useImportActivity as jest.MockedFunction<typeof useImportActivity>;
const mockedGetStudioWebsiteRoute = getStudioWebsiteRoute as jest.MockedFunction<typeof getStudioWebsiteRoute>;

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RecentApps (legacy suite)', () => {
  let mockPush: jest.Mock;
  const now = new Date().toISOString();
  let mockWebsitesRefetch: jest.Mock;
  let mockImportRefetch: jest.Mock;

  const sampleWebsites: Website[] = [
    {
      id: 'site1',
      name: 'Website 1',
      description: 'First test website',
      category: 'blog',
      icon: '🌐',
      metadata: {},
      settings: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'site2',
      name: 'Website 2',
      description: 'Second test website',
      category: 'portfolio',
      icon: null,
      metadata: {},
      settings: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  beforeEach(() => {
    mockedUseRouter.mockReset();
    mockedUseWebsites.mockReset();
    mockedUseImportActivity.mockReset();
    mockedGetStudioWebsiteRoute.mockReset();

    mockDeleteWebsiteMutation.mutateAsync.mockReset();
    mockDeleteWebsiteMutation.reset.mockReset();
    mockDeleteWebsiteMutation.isPending = false;
    mockDeleteWebsiteMutation.error = null;

    mockWebsitesRefetch = jest.fn().mockResolvedValue(undefined);
    mockImportRefetch = jest.fn().mockResolvedValue(undefined);
    mockPush = jest.fn();

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

    mockedGetStudioWebsiteRoute.mockReturnValue('/studio/site-builder?websiteId=default');
  });

  it('renders loading skeleton when websites query is pending', () => {
    mockedUseWebsites.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isFetching: true,
      refetch: mockWebsitesRefetch,
    } as any);

    renderWithClient(<RecentApps />);

    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state guidance when there is no activity', async () => {
    mockedUseWebsites.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);
    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockImportRefetch,
    } as any);

    renderWithClient(<RecentApps />);

    await waitFor(() => {
      expect(screen.getByText(/No recent imports yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Start by importing a website/i)).toBeInTheDocument();
    });
  });

  it('renders website cards and navigates on click', async () => {
    mockedUseWebsites.mockReturnValue({
      data: sampleWebsites,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    const destination = '/studio/site-builder?websiteId=site1';
    mockedGetStudioWebsiteRoute.mockReturnValue(destination);

    renderWithClient(<RecentApps />);

    await waitFor(() => {
      expect(screen.getByText('Website 1')).toBeInTheDocument();
      expect(screen.getByText('Website 2')).toBeInTheDocument();
    });

    const card = screen.getByRole('button', { name: /^Website 1\b/i });
    fireEvent.click(card);
    expect(mockedGetStudioWebsiteRoute).toHaveBeenCalledWith('site1', { legacyView: 'overview' });
    expect(mockPush).toHaveBeenCalledWith(destination);
  });

  it('supports View All → Show Less workflow', async () => {
    const manyWebsites: Website[] = Array.from({ length: 14 }, (_, i) => ({
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
    }));

    mockedUseWebsites.mockReturnValue({
      data: manyWebsites,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    renderWithClient(<RecentApps maxItems={12} />);

    await waitFor(() => {
      expect(screen.getByText('View All (14)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View All (14)'));

    await waitFor(() => {
      const cards = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('Website'));
      expect(cards).toHaveLength(14);
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Show Less'));

    await waitFor(() => {
      const cards = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.includes('Website'));
      expect(cards).toHaveLength(12);
    });
  });

  it('supports manual refresh via button', async () => {
    mockedUseWebsites.mockReturnValue({
      data: sampleWebsites,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: mockImportRefetch,
    } as any);

    renderWithClient(<RecentApps />);

    const refreshButton = await screen.findByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockWebsitesRefetch).toHaveBeenCalled();
      expect(mockImportRefetch).toHaveBeenCalled();
    });
  });

  it('renders error state when websites query fails', async () => {
    mockedUseWebsites.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load websites'),
      isFetching: false,
      refetch: mockWebsitesRefetch,
    } as any);

    renderWithClient(<RecentApps />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load recent activity/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to load websites/i)).toBeInTheDocument();
    });
  });
});

