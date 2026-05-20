import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/auth/hooks';
import { WebsiteCreator } from '../website-creator';
import { AIPromptProcessor } from '@/lib/services/ai-prompt-processor';
import { useToast } from '@/components/ui/use-toast';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store';
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session';
import { adoptDashboardChatSession, createPromptIdempotencyKey, getDashboardSessionId, logDashboardPrompt } from '@/lib/studio/services/dashboard-chat-logger';
import { monitoring } from '@/lib/monitoring';

jest.mock('next/navigation');
jest.mock('@/lib/auth/hooks', () => ({
  useUser: jest.fn(),
  useAuthActions: jest.fn(() => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  })),
}));
jest.mock('@/lib/services/ai-prompt-processor');
jest.mock('@/components/ui/use-toast');
jest.mock('@/lib/config/deployment', () => ({
  getStudioWebsiteRoute: jest.fn(),
}));
jest.mock('@/lib/studio/services/dashboard-chat-logger', () => ({
  createPromptIdempotencyKey: jest.fn(() => 'idempotency-key'),
  getDashboardSessionId: jest.fn(() => 'dashboard-session'),
  logDashboardPrompt: jest.fn(),
  adoptDashboardChatSession: jest.fn(),
}));
jest.mock('@/lib/monitoring', () => ({
  monitoring: {
    logError: jest.fn(),
  },
}));

const mockPromptAuthModal = jest.fn();
jest.mock('../prompt-auth-modal', () => ({
  PromptAuthModal: (props: any) => {
    mockPromptAuthModal(props);
    if (!props.open) return null;
    return (
      <div data-testid="auth-modal">
        <button type="button" data-testid="auth-success" onClick={() => props.onAuthenticated?.()} />
        <button type="button" data-testid="auth-close" onClick={props.onClose} />
      </div>
    );
  },
}));

const defaultProcessedPrompt = {
  websiteName: 'Test Website',
  description: 'Test description',
  category: 'general',
  suggestedFeatures: [],
  technicalRequirements: [],
  targetAudience: 'general users',
};

describe('WebsiteCreator', () => {
  let pushMock: jest.Mock;
  let queryClient: QueryClient;
  const mockToast = jest.fn();
  const mockProcessPrompt = jest.fn();
  const mockCreateWebsiteFromPrompt = jest.fn();
  const mockGetStudioWebsiteRoute = getStudioWebsiteRoute as jest.MockedFunction<typeof getStudioWebsiteRoute>;
  const mockUseUser = useUser as jest.Mock;

  const renderComponent = () => {
    queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <WebsiteCreator />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    pushMock = jest.fn();
    mockToast.mockReset();
    mockProcessPrompt.mockReset();
    mockCreateWebsiteFromPrompt.mockReset();
    mockGetStudioWebsiteRoute.mockReset();
    mockPromptAuthModal.mockClear();
    jest.clearAllMocks();

    mockUseUser.mockReturnValue({ id: 'test-user' });
    (getDashboardSessionId as jest.Mock).mockReturnValue('dashboard-test-user');
    (createPromptIdempotencyKey as jest.Mock).mockReturnValue('session-hash');
    (logDashboardPrompt as jest.Mock).mockResolvedValue(undefined);
    (adoptDashboardChatSession as jest.Mock).mockResolvedValue(undefined);
    (monitoring.logError as jest.Mock).mockReset();

    (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    (AIPromptProcessor as jest.Mock).mockImplementation(() => ({
      processPrompt: mockProcessPrompt,
      createWebsiteFromPrompt: mockCreateWebsiteFromPrompt,
    }));

    mockProcessPrompt.mockResolvedValue(defaultProcessedPrompt);

    mockCreateWebsiteFromPrompt.mockResolvedValue({
      type: 'ai',
      websiteId: 'test-website-id-123',
      prompt: defaultProcessedPrompt,
    });

    mockGetStudioWebsiteRoute.mockReturnValue('/studio/site-builder?websiteId=test-website-id-123');

    const sessionStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
      configurable: true,
    });

    useImportTrackerStore.setState({ jobs: [] });
  });

  afterEach(() => {
    if (queryClient) {
      queryClient.clear();
      queryClient = undefined as unknown as QueryClient;
    }
  });

  it('renders the AI prompt section', () => {
    renderComponent();
    expect(screen.getByText('What would you build today?')).toBeInTheDocument();
  });

  it('creates a website successfully for AI builds', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'A CRM for small businesses');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockProcessPrompt).toHaveBeenCalledWith('A CRM for small businesses');
      expect(mockCreateWebsiteFromPrompt).toHaveBeenCalledWith('A CRM for small businesses', defaultProcessedPrompt);
    });
  });

  it('navigates using the deployment helper output for AI builds', async () => {
    const destination = '/studio/site-builder?websiteId=test-website-id-123';
    mockGetStudioWebsiteRoute.mockReturnValue(destination);

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Route test');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateWebsiteFromPrompt).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockGetStudioWebsiteRoute).toHaveBeenCalledWith('test-website-id-123', { legacyView: 'ai' });
      expect(pushMock).toHaveBeenCalledWith(destination);
    });
  });

  it('stores prompt metadata in sessionStorage for AI builds', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      const setCalls = (window.sessionStorage.setItem as jest.Mock).mock.calls;
      expect(setCalls.some(([key]) => key === 'ai_prompt_test-website-id-123')).toBe(true);
    });
  });

  it('handles import job responses and redirects to the builder', async () => {
    const importJob = {
      id: 'job-123',
      websiteId: 'site-789',
      url: 'https://example.com',
      status: 'pending',
      progress: 0,
      stage: 'initializing',
      message: 'Import requested via AI assistant',
      mode: 'new' as const,
      startedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      completedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      queuePosition: null,
      website: null,
    };

    mockCreateWebsiteFromPrompt.mockResolvedValueOnce({
      type: 'import',
      job: importJob,
      prompt: defaultProcessedPrompt,
      url: importJob.url,
    });

    mockGetStudioWebsiteRoute.mockReturnValue('/studio/site-builder?websiteId=site-789&importJobId=job-123');

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Import https://example.com');
    fireEvent.click(createButton);

    await waitFor(() => {
      const jobs = useImportTrackerStore.getState().jobs;
      expect(jobs[0]?.id).toBe('job-123');
      const setCalls = (window.sessionStorage.setItem as jest.Mock).mock.calls;
      expect(setCalls.some(([key]) => key === 'import_prompt_job-123')).toBe(true);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Import started',
        description: 'Importing https://example.com. Opening site builder...',
      });
    });

    const cached = queryClient.getQueryData(['dashboard', 'import-activity']);
    expect(Array.isArray(cached)).toBe(true);
    expect((cached as any)[0]?.id).toBe('job-123');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/studio/site-builder?websiteId=site-789&importJobId=job-123');
    });
  });

  it('adopts the dashboard session after successful AI website creation', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Adopt session test');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateWebsiteFromPrompt).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(adoptDashboardChatSession).toHaveBeenCalledWith({
        sourceSessionId: 'dashboard-test-user',
        websiteId: 'test-website-id-123',
        targetSessionId: getBuilderAssistantSessionId('test-website-id-123'),
      });
    });
  });

  it('logs telemetry and continues when prompt logging fails', async () => {
    (logDashboardPrompt as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Handle logger failure');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateWebsiteFromPrompt).toHaveBeenCalled();
    });

    expect(monitoring.logError).toHaveBeenCalledWith(
      'dashboard_prompt_log_failed',
      expect.any(Error),
      expect.objectContaining({ sessionId: 'dashboard-test-user' }),
    );
  });

  it('shows a success toast on AI creation', async () => {
    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Website Created!',
        description: 'Test Website is ready for development',
      });
    });
  });

  it('handles creation failures gracefully and avoids navigation', async () => {
    mockCreateWebsiteFromPrompt.mockRejectedValue(new Error('Storage quota exceeded'));

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Creation Failed',
        description: 'Storage quota exceeded',
        variant: 'destructive',
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('handles prompt processing errors', async () => {
    mockProcessPrompt.mockRejectedValue(new Error('Failed to process prompt'));

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Creation Failed',
        description: 'Failed to process prompt',
        variant: 'destructive',
      });
    });
  });

  it('disables inputs while creating', async () => {
    mockCreateWebsiteFromPrompt.mockReturnValue(new Promise(() => {}));

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Test prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(textarea).toBeDisabled();
      expect(createButton).toBeDisabled();
    });
  });

  it('shows loading state during creation', async () => {
    let resolvePromise: (value: unknown) => void;
    mockCreateWebsiteFromPrompt.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Loading state');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    resolvePromise({ type: 'ai', websiteId: 'test-website-id-123', prompt: defaultProcessedPrompt });
  });

  it('persists processed prompt data in session storage', async () => {
    const processedData = {
      websiteName: 'My CRM',
      description: 'CRM for businesses',
      category: 'crm',
      suggestedFeatures: ['auth', 'payments'],
      technicalRequirements: ['real-time'],
      targetAudience: 'businesses',
    };

    mockProcessPrompt.mockResolvedValue(processedData);
    mockCreateWebsiteFromPrompt.mockResolvedValue({
      type: 'ai',
      websiteId: 'test-website-id-123',
      prompt: processedData,
    });

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'CRM prompt');
    fireEvent.click(createButton);

    await waitFor(() => {
      const setCalls = (window.sessionStorage.setItem as jest.Mock).mock.calls;
      const storedData = setCalls.find(([key]) => key === 'ai_prompt_test-website-id-123')?.[1];
      expect(storedData).toBeTruthy();
      const parsed = JSON.parse(storedData as string);
      expect(parsed.original).toBe('CRM prompt');
      expect(parsed.processed).toEqual(processedData);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  it('opens auth modal and replays prompt after authentication for anonymous users', async () => {
    mockUseUser.mockReturnValue(null);

    renderComponent();

    const textarea = screen.getByPlaceholderText(/Describe your website idea/);
    const createButton = screen.getByRole('button', { name: /Create Website/i });

    await userEvent.type(textarea, 'Anonymous prompt example');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockPromptAuthModal).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'dashboard_pending_prompt',
        expect.stringContaining('Anonymous prompt example')
      );
      expect(mockCreateWebsiteFromPrompt).not.toHaveBeenCalled();
    });

    const lastCall = mockPromptAuthModal.mock.calls[mockPromptAuthModal.mock.calls.length - 1][0];
    act(() => {
      lastCall.onAuthenticated();
    });

    await waitFor(() => {
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('dashboard_pending_prompt');
      expect(mockCreateWebsiteFromPrompt).toHaveBeenCalledWith('Anonymous prompt example', defaultProcessedPrompt);
    });
  });
});
