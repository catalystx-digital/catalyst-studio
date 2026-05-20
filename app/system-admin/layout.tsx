import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/session-cookie';
import { getSessionByCookieValue } from '@/lib/auth/session-store';

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
  const cookieStore = await cookies();
  const session = await getSessionByCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value ?? null);

  // No user = redirect to sign-in
  if (!session) {
    redirect('/sign-in?redirect_url=/system-admin');
  }

  // Check if user is an active system admin
  const systemAdmin = await prisma.systemAdmin.findUnique({
    where: { userId: session.userId },
    select: { isActive: true },
  });

  // Not a system admin or inactive = redirect to dashboard
  if (!systemAdmin?.isActive) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
