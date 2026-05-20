import { fireEvent, render, screen } from '@testing-library/react';

import { UsageOverview } from '../usage-overview';
import { useAccountUsage } from '@/lib/api/hooks/use-account-usage';

jest.mock('@/lib/api/hooks/use-account-usage');

const mockedUseAccountUsage = useAccountUsage as jest.MockedFunction<typeof useAccountUsage>;

describe('UsageOverview', () => {
  beforeEach(() => {
    mockedUseAccountUsage.mockReset();
  });

  it('renders quota cards with usage data', () => {
    mockedUseAccountUsage.mockReturnValue({
      data: {
        quotas: {
          import_page: {
            limit: 5,
            used: 2,
            available: 3,
            period: 'day',
            mode: 'enforce',
          },
          chat_tokens: {
            limit: 20000,
            used: 3500,
            available: 16500,
            period: 'day',
            mode: 'log',
          },
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    render(<UsageOverview />);

    expect(screen.getByText(/Website imports/i)).toBeInTheDocument();
    expect(screen.getByText(/2 used/i)).toBeInTheDocument();
    expect(screen.getByText(/5 limit/i)).toBeInTheDocument();
    expect(screen.getByText(/3 remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/AI chat tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/3,500 used/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh usage/i })).toBeInTheDocument();
  });

  it('shows unlimited messaging when no limit is enforced', () => {
    mockedUseAccountUsage.mockReturnValue({
      data: {
        quotas: {
          import_page: {
            limit: null,
            used: 0,
            available: null,
            period: 'all',
            mode: 'off',
          },
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    render(<UsageOverview />);

    expect(screen.getByText(/No enforced limit for this metric/i)).toBeInTheDocument();
  });

  it('surfaces error state and allows retry', () => {
    const refetch = jest.fn();
    mockedUseAccountUsage.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new Error('Failed to load usage'),
      refetch,
    } as any);

    render(<UsageOverview />);

    expect(screen.getByText(/Unable to load usage metrics/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refresh usage/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
