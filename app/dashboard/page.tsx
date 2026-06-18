import { Metadata } from 'next';

import { headers } from 'next/headers';

import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { AUTHENTICATED_HEADER } from '@/lib/auth/constants';

export const metadata: Metadata = {
  title: 'Dashboard - Catalyst Studio',
  description: 'Explore the visual site builder, AI import & generation, live preview, structured CMS, and headless export in the seeded demo. One-command quickstart experience.',
};

export default async function DashboardPage() {
  const headersList = await headers();
  const isAuthenticated = headersList.get(AUTHENTICATED_HEADER) === '1';

  return <DashboardHome isAuthenticated={isAuthenticated} />;
}
