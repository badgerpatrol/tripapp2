import { prisma } from "../lib/prisma";
import { getUserTrips } from "../server/services/trips";

async function checkInvitations() {
  // Find user spod@test.com
  const user = await prisma.user.findUnique({
    where: { email: "spod@test.com" },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log("User spod@test.com not found");
    return;
  }

  console.log("User:", user);

  // Find their trip memberships
  const memberships = await prisma.tripMember.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    include: {
      trip: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log("\nMemberships:");
  memberships.forEach((m) => {
    console.log(`  - Trip: ${m.trip.name} (${m.trip.id})`);
    console.log(`    RSVP Status: ${m.rsvpStatus}`);
    console.log(`    Role: ${m.role}`);
  });

  // Check what getUserTrips returns
  const trips = await getUserTrips(user.id);

  console.log(`\ngetUserTrips returned ${trips.length} trips:`);
  trips.forEach((t) => {
    console.log(`  - ${t.name}`);
    console.log(`    Members count: ${t.members.length}`);
    const userMember = t.members.find(m => m.userId === user.id);
    console.log(`    User's RSVP: ${userMember?.rsvpStatus || "NOT FOUND"}`);
  });

  await prisma.$disconnect();
}

checkInvitations().catch(console.error);
