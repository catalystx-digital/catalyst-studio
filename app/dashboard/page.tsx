import { Metadata } from 'next';

import { headers } from 'next/headers';

import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { AUTHENTICATED_HEADER } from '@/lib/auth/constants';

export const metadata: Metadata = {
  title: 'Dashboard - Catalyst Studio',
  description: 'Manage all your websites from one place',
};

export default async function DashboardPage() {
  const headersList = await headers();
  const isAuthenticated = headersList.get(AUTHENTICATED_HEADER) === '1';

  return <DashboardHome isAuthenticated={isAuthenticated} />;
}
