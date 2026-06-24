import { autoAcceptPendingInvitations } from '@/lib/auth/account';

describe('autoAcceptPendingInvitations', () => {
  it('does not accept invitations for an unverified email address', async () => {
    const prisma = {
      invitation: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      accountMembership: {
        create: jest.fn(),
      },
    };

    await autoAcceptPendingInvitations(prisma as any, 'user-1', 'victim@example.com', {
      emailVerifiedAt: null,
    });

    expect(prisma.invitation.findMany).not.toHaveBeenCalled();
    expect(prisma.accountMembership.create).not.toHaveBeenCalled();
    expect(prisma.invitation.update).not.toHaveBeenCalled();
  });
});
