import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { RecentApps } from '../recent-apps';
import { useDeleteWebsite, useWebsites } from '@/lib/api/hooks/use-websites';
import { useImportActivity } from '@/lib/api/hooks/use-import-activity';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { useToast } from '@/components/ui/use-toast';

jest.mock('next/navigation');
jest.mock('@/lib/api/hooks/use-websites');
jest.mock('@/lib/api/hooks/use-import-activity');
jest.mock('@/lib/config/deployment', () => ({
  getStudioWebsiteRoute: jest.fn(),
}));
jest.mock('@/components/ui/use-toast');
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const mockedUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseWebsites = useWebsites as jest.MockedFunction<typeof useWebsites>;
const mockedUseDeleteWebsite = useDeleteWebsite as jest.MockedFunction<typeof useDeleteWebsite>;
const mockedUseImportActivity = useImportActivity as jest.MockedFunction<typeof useImportActivity>;
const mockedGetStudioWebsiteRoute = getStudioWebsiteRoute as jest.MockedFunction<typeof getStudioWebsiteRoute>;
const mockedUseToast = useToast as unknown as jest.MockedFunction<typeof useToast>;

const now = new Date().toISOString();

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RecentApps (targeted)', () => {
  let pushMock: jest.Mock;

  beforeEach(() => {
    mockedUseRouter.mockReset();
    mockedUseWebsites.mockReset();
    mockedUseDeleteWebsite.mockReset();
    mockedUseImportActivity.mockReset();
    mockedGetStudioWebsiteRoute.mockReset();
    mockedUseToast.mockReset();

    pushMock = jest.fn();
    deleteMutationMock = jest.fn();
    resetDeleteMock = jest.fn();
    toastMock = jest.fn();

    mockedUseRouter.mockReturnValue({
      push: pushMock,
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    } as unknown as ReturnType<typeof useRouter>);

    mockedGetStudioWebsiteRoute.mockImplementation((websiteId: string) => `/studio/site-builder?websiteId=${websiteId}`);

    mockedUseDeleteWebsite.mockReturnValue({
      mutateAsync: deleteMutationMock,
      isPending: false,
      error: null,
      reset: resetDeleteMock,
    } as any);

    mockedUseToast.mockReturnValue({ toast: toastMock } as any);
  });

  it('routes via deployment helper when clicking a website card', () => {
    mockedUseWebsites.mockReturnValue({
      data: [
        {
          id: 'site-123',
          name: 'Example Site',
          description: 'Example description',
          category: 'marketing',
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
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    const studioDestination = '/studio/site-builder?websiteId=site-123';
    mockedGetStudioWebsiteRoute.mockReturnValue(studioDestination);

    renderWithClient(<RecentApps />);

    const card = screen.getByText('Example Site').closest('[role="button"]');
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    expect(mockedGetStudioWebsiteRoute).toHaveBeenCalledWith('site-123', { legacyView: 'overview' });
    expect(pushMock).toHaveBeenCalledWith(studioDestination);
  });

  it('shows import progress, messages, and AI badge when data is present', () => {
    mockedUseWebsites.mockReturnValue({
      data: [
        {
          id: 'site-1',
          name: 'Design Hub',
          description: 'Collaborative design workspace',
          category: 'workspace',
          icon: null,
          metadata: { createdViaAI: true, targetAudience: 'Designers' },
          settings: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [
        {
          id: 'import-1',
          websiteId: 'site-1',
          status: 'processing',
          state: 'active',
          progress: 45,
          stage: 'analyzing',
          message: 'Analyzing structure',
          url: 'https://example.com',
          createdAt: now,
          startedAt: now,
          updatedAt: now,
          completedAt: null,
          queuePosition: null,
          estimatedStartSeconds: null,
          website: null,
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<RecentApps />);

    expect(screen.getByText(/Importing/i)).toBeInTheDocument();
    expect(screen.getByText(/45%/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyzing structure/i)).toBeInTheDocument();
    expect(screen.getAllByText(/AI Build/i)[0]).toBeInTheDocument();
  });

  it('shows queued messaging and ETA when imports exceed concurrency cap', () => {
    mockedUseWebsites.mockReturnValue({
      data: [
        {
          id: 'site-2',
          name: 'Queue Test',
          description: null,
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
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [
        {
          id: 'import-queued',
          websiteId: 'site-2',
          status: 'pending',
          state: 'queued',
          progress: 0,
          stage: 'queued',
          message: 'Waiting in queue',
          url: 'https://example.com',
          createdAt: now,
          startedAt: null,
          updatedAt: now,
          completedAt: null,
          queuePosition: 2,
          estimatedStartSeconds: 180,
          website: null,
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<RecentApps />);

    expect(screen.getByText(/Queued • #2/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting in queue/i)).toBeInTheDocument();
    expect(screen.getByText(/ETA about 3 minutes/i)).toBeInTheDocument();
  });

  it('shows empty guidance when no websites or imports exist', () => {
    mockedUseWebsites.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<RecentApps />);

    expect(screen.getByText(/No recent imports yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Start by importing a website/i)).toBeInTheDocument();
  });

  it('renders error state when quota fetch fails', () => {
    mockedUseWebsites.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load websites'),
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<RecentApps />);

    expect(screen.getByText(/Unable to load recent activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load websites/i)).toBeInTheDocument();
  });

  it('confirms deletion before invoking the delete mutation', async () => {
    deleteMutationMock.mockResolvedValue({ id: 'site-123', message: 'Website deleted successfully' });

    mockedUseWebsites.mockReturnValue({
      data: [
        {
          id: 'site-123',
          name: 'Example Site',
          description: 'Example description',
          category: 'marketing',
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
    } as any);

    mockedUseImportActivity.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(<RecentApps />);

    fireEvent.click(screen.getByLabelText('Website actions for Example Site'));
    fireEvent.click(screen.getAllByText('Delete website')[0]);

    expect(screen.getByText('Delete “Example Site”?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete website' }));

    await waitFor(() => expect(deleteMutationMock).toHaveBeenCalledWith('site-123'));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(resetDeleteMock).toHaveBeenCalled();
  });
});
