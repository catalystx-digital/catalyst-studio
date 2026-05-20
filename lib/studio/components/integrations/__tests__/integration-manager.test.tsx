import '@testing-library/jest-dom';

import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { IntegrationManager } from '@/lib/studio/components/integrations/integration-manager';

expect.extend(toHaveNoViolations);

const mockUseAccountIntegrations = jest.fn();
const mockUseCreateIntegration = jest.fn();
const mockUseUpdateIntegration = jest.fn();
const mockUseRemoveIntegration = jest.fn();
const mockUseTestIntegration = jest.fn();

jest.mock('@/lib/studio/hooks/use-account-integrations', () => ({
  useAccountIntegrations: (args: unknown) => mockUseAccountIntegrations(args),
  useCreateIntegration: () => mockUseCreateIntegration(),
  useUpdateIntegration: () => mockUseUpdateIntegration(),
  useRemoveIntegration: () => mockUseRemoveIntegration(),
  useTestIntegration: () => mockUseTestIntegration(),
}));

function createMutationMock(overrides: Partial<ReturnType<typeof buildMutation>> = {}) {
  return { ...buildMutation(), ...overrides };
}

function buildMutation() {
  return {
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    error: null,
  };
}

function defaultQueryResult() {
  return {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  };
}

describe('IntegrationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccountIntegrations.mockReturnValue(defaultQueryResult());
    mockUseCreateIntegration.mockReturnValue(createMutationMock());
    // The component invokes useUpdateIntegration twice; supply independent mocks.
    const firstUpdate = createMutationMock();
    const secondUpdate = createMutationMock();
    mockUseUpdateIntegration
      .mockReturnValueOnce(firstUpdate)
      .mockReturnValueOnce(secondUpdate)
      .mockImplementation(createMutationMock);
    mockUseRemoveIntegration.mockReturnValue(createMutationMock());
    mockUseTestIntegration.mockReturnValue(createMutationMock());
  });

  it('renders empty state and passes accessibility checks', async () => {
    const { container } = render(<IntegrationManager />);

    expect(
      screen.getByText('Connect your first integration', { exact: false }),
    ).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders integration cards with provider details', () => {
    mockUseAccountIntegrations.mockReturnValue({
      ...defaultQueryResult(),
      data: [
        {
          id: 'int-1',
          accountId: 'acct-1',
          provider: 'optimizely',
          displayName: 'Optimizely Prod',
          status: 'enabled',
          providerDisabled: false,
          config: { clientId: 'abc123' },
          secretFields: { clientSecret: true },
          lastTestedAt: '2025-01-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      ],
    });

    render(<IntegrationManager />);

    expect(screen.getByText('Optimizely Prod')).toBeInTheDocument();
    expect(screen.getByText('Optimizely CMS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeInTheDocument();
  });

  it('opens the create modal when Add Integration is clicked', async () => {
    render(<IntegrationManager />);

    fireEvent.click(screen.getAllByRole('button', { name: /Add Integration/i })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Connect a provider/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Provider/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Display name/i)).toBeInTheDocument();
  });

  it('shows Contentstack-specific form fields when selected', async () => {
    render(<IntegrationManager />);

    fireEvent.click(screen.getAllByRole('button', { name: /Add Integration/i })[0]);

    const dialog = await screen.findByRole('dialog');
    const combobox = within(dialog).getByRole('combobox', { name: /Provider/i });
    const optionNode = await screen.findByRole('option', { name: 'Contentstack', hidden: true });
    const nativeSelect = optionNode.closest('select') as HTMLSelectElement;
    expect(nativeSelect).not.toBeNull();
    fireEvent.change(nativeSelect!, { target: { value: 'contentstack' } });
    expect(combobox).toHaveTextContent('Contentstack');

    expect(within(dialog).getByLabelText('Stack API Key')).toHaveAttribute('type', 'password');
    expect(within(dialog).getByLabelText('Management Token')).toHaveAttribute('type', 'password');
    expect(within(dialog).getByLabelText('Environment')).toHaveAttribute('placeholder', 'development');
    expect(within(dialog).getByLabelText('Locale')).toHaveAttribute('placeholder', 'en-us');
    expect(within(dialog).getByLabelText('Branch')).toHaveAttribute('placeholder', 'main');
    expect(within(dialog).getByText(/Target environment for publishing/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Default locale code in lowercase/i)).toBeInTheDocument();
  });

  it('shows Contentstack secret badges during edit', async () => {
    mockUseAccountIntegrations.mockReturnValue({
      ...defaultQueryResult(),
      data: [
        {
          id: 'int-2',
          accountId: 'acct-1',
          provider: 'contentstack' as const,
          displayName: 'Contentstack Dev',
          status: 'enabled',
          providerDisabled: false,
          config: {
            stackApiKey: '********',
            managementToken: '********',
            environment: 'development',
            locale: 'en-us',
            branch: 'main',
          },
          secretFields: { stackApiKey: true, managementToken: true },
          lastTestedAt: '2025-01-05T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      ],
    });

    render(<IntegrationManager />);

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    const dialog = await screen.findByRole('dialog');
    const secretBadges = within(dialog).getAllByText(/Secret stored/i);
    expect(secretBadges).toHaveLength(2);

    expect(within(dialog).getByLabelText('Stack API Key')).toHaveAttribute('placeholder', '********');
    expect(within(dialog).getByLabelText('Management Token')).toHaveAttribute('placeholder', '********');
  });
});

