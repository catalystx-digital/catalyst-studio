import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/lib/studio/hooks/use-account-integrations', () => ({
  useAccountIntegrations: jest.fn(),
}));

import { useAccountIntegrations } from '@/lib/studio/hooks/use-account-integrations';
import { IntegrationSelector } from '../integration-selector';
import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';

describe('IntegrationSelector', () => {
  const mockedUseIntegrations = useAccountIntegrations as jest.Mock;

  afterEach(() => {
    mockedUseIntegrations.mockReset();
  });

  it('renders loading skeleton', () => {
    mockedUseIntegrations.mockReturnValue({ isLoading: true, data: undefined, isError: false });

    render(<IntegrationSelector onSelect={jest.fn()} />);

    expect(screen.getByTestId('integration-selector-loading')).toBeInTheDocument();
  });

  it('renders empty state when no integrations', () => {
    mockedUseIntegrations.mockReturnValue({ data: [], isLoading: false, isError: false });

    render(<IntegrationSelector onSelect={jest.fn()} />);

    expect(screen.getByTestId('integration-selector-empty')).toBeInTheDocument();
    expect(screen.getByText(/No integrations connected/i)).toBeInTheDocument();
  });

  it('allows selecting an integration card', () => {
    const onSelect = jest.fn();
    const integrations: AccountIntegrationRecord[] = [
      {
        id: 'int-1',
        accountId: 'acc-1',
        provider: 'optimizely',
        displayName: 'Optimizely Prod',
        status: 'enabled',
        providerDisabled: false,
        config: {},
        secretFields: {},
        lastTestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    mockedUseIntegrations.mockReturnValue({ data: integrations, isLoading: false, isError: false });

    render(<IntegrationSelector onSelect={onSelect} />);

    const card = screen.getByTestId('integration-card');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'int-1' }));
  });

  it('renders retry alert when request fails', () => {
    mockedUseIntegrations.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });

    render(<IntegrationSelector onSelect={jest.fn()} />);

    expect(screen.getByTestId('integration-selector-error')).toBeInTheDocument();
  });
});


