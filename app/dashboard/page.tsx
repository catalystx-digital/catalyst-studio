import { Metadata } from 'next';

import { headers } from 'next/headers';

import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { readUserFromHeaders } from '@/lib/supabase/user-header';

export const metadata: Metadata = {
  title: 'Dashboard - Catalyst Studio',
  description: 'Manage all your websites from one place',
};

export default async function DashboardPage() {
  const headersList = await headers();
  const serializedUser = readUserFromHeaders(headersList);

  return <DashboardHome isAuthenticated={Boolean(serializedUser)} />;
}
