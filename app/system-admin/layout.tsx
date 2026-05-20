import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readUserFromHeaders } from '@/lib/supabase/user-header';
import { prisma } from '@/lib/prisma';

/**
 * System Admin Layout with Server-Side Authorization
 *
 * This layout enforces that only active system admins can access
 * the /system-admin route hierarchy. Non-admins are redirected
 * to the dashboard.
 */
export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const user = readUserFromHeaders(headersList);

  // No user = redirect to sign-in
  if (!user) {
    redirect('/sign-in?redirect_url=/system-admin');
  }

  // Check if user is an active system admin
  const systemAdmin = await prisma.systemAdmin.findUnique({
    where: { userId: user.id },
    select: { isActive: true },
  });

  // Not a system admin or inactive = redirect to dashboard
  if (!systemAdmin?.isActive) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
