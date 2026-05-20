import { render, screen } from '@testing-library/react';

import { DashboardHome } from '../dashboard-home';

describe('DashboardHome', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function setupMocks() {
    jest.doMock('../dashboard-layout', () => ({
      DashboardLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="layout">{children}</div>
      ),
    }));
    jest.doMock('../website-creator', () => ({
      WebsiteCreator: () => <div data-testid="website-creator">prompt</div>,
    }));
    jest.doMock('../recent-apps', () => ({
      RecentApps: ({ className }: { className?: string }) => (
        <div data-testid="recent-apps" data-class={className}>
          websites
        </div>
      ),
    }));
  }

  it('renders website creator and recent apps for authenticated users', async () => {
    setupMocks();

    const { DashboardHome: MockedDashboardHome } = await import('../dashboard-home');

    render(<MockedDashboardHome isAuthenticated />);

    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('website-creator')).toBeInTheDocument();
    expect(screen.getByTestId('recent-apps')).toBeInTheDocument();
  });

  it('renders website creator and recent apps for anonymous users', async () => {
    setupMocks();

    const { DashboardHome: MockedDashboardHome } = await import('../dashboard-home');

    render(<MockedDashboardHome isAuthenticated={false} />);

    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('website-creator')).toBeInTheDocument();
    expect(screen.getByTestId('recent-apps')).toBeInTheDocument();
  });
});
