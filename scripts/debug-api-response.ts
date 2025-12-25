import { getUserTrips } from "../server/services/trips";
import { prisma } from "../lib/prisma";

async function debugApiResponse() {
  // Find user spod@test.com
  const user = await prisma.user.findUnique({
    where: { email: "spod@test.com" },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log("User spod@test.com not found");
    return;
  }

  console.log("User Firebase UID:", user.id);

  // Get trips as the API would return them
  const trips = await getUserTrips(user.id);

  console.log(`\nAPI would return ${trips.length} trips:\n`);

  trips.forEach((trip) => {
    console.log(`Trip: ${trip.name}`);
    console.log(`  ID: ${trip.id}`);
    console.log(`  Status: ${trip.status}`);
    console.log(`  Member count (non-viewer): ${trip._count.members}`);
    console.log(`  Current user membership:`);

    const myMembership = trip.members[0]; // Only current user's membership is returned
    if (myMembership) {
      console.log(`    userId: ${myMembership.userId}`);
      console.log(`    RSVP: ${myMembership.rsvpStatus}`);
      console.log(`    Role: ${myMembership.role}`);
    } else {
      console.log(`    NOT FOUND`);
    }

    console.log();
  });

  await prisma.$disconnect();
}

debugApiResponse().catch(console.error);
