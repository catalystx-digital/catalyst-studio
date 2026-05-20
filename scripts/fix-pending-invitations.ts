import { PrismaClient, InvitationStatus } from '../lib/generated/prisma';
const prisma = new PrismaClient();

async function fixPendingInvitations() {
  // Find all pending invitations
  const pendingInvitations = await prisma.invitation.findMany({
    where: {
      status: InvitationStatus.pending,
      expiresAt: { gt: new Date() },
    },
  });

  console.log(`Found ${pendingInvitations.length} pending invitations`);

  for (const invitation of pendingInvitations) {
    // Check if a user exists with this email
    const user = await prisma.user.findFirst({
      where: { email: invitation.email },
    });

    if (!user) {
      console.log(`No user found for ${invitation.email}, skipping`);
      continue;
    }

    // Check if membership already exists
    const existingMembership = await prisma.accountMembership.findUnique({
      where: {
        accountId_userId: {
          accountId: invitation.accountId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      console.log(`Membership already exists for ${invitation.email} in account ${invitation.accountId}, marking as accepted`);
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.accepted,
          respondedAt: new Date(),
        },
      });
      continue;
    }

    // Filter out any deleted websites
    let validWebsiteIds: string[] = [];
    if (invitation.websiteIds?.length) {
      const validWebsites = await prisma.website.findMany({
        where: {
          id: { in: invitation.websiteIds },
          accountId: invitation.accountId,
        },
        select: { id: true },
      });
      validWebsiteIds = validWebsites.map((w) => w.id);
    }

    // Create membership
    await prisma.accountMembership.create({
      data: {
        accountId: invitation.accountId,
        userId: user.id,
        role: invitation.role,
        websiteAccess: invitation.websiteAccess,
        websiteIds: validWebsiteIds,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      },
    });

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.accepted,
        respondedAt: new Date(),
      },
    });

    console.log(`Accepted invitation for ${invitation.email} to account ${invitation.accountId}`);
  }

  await prisma.$disconnect();
  console.log('Done!');
}

fixPendingInvitations().catch(console.error);
