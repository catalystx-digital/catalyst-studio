import { render, screen } from '@testing-library/react';

import { DashboardHome } from '../dashboard-home';

describe('DashboardHome', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders dashboard content for authenticated users (with websites grid)', () => {
    render(<DashboardHome isAuthenticated />);

    // Main heading from our demo welcome hero (prominent for quickstart/demo users)
    expect(screen.getByText(/Welcome to the Catalyst Studio demo/i)).toBeInTheDocument();
    // Feature discovery links are present
    expect(screen.getByText(/Try these features with the seeded demo site/i)).toBeInTheDocument();
    expect(screen.getByText(/Visual Site Builder/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Database-Backed Preview/i)).toBeInTheDocument();
  });

  it('renders sign-in guidance for anonymous users', () => {
    render(<DashboardHome isAuthenticated={false} />);

    expect(screen.getByText(/Please sign in to view your websites/i)).toBeInTheDocument();
  });
});
