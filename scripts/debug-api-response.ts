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
    console.log(`  Members (${trip.members.length}):`);

    trip.members.forEach((member) => {
      console.log(`    - ${member.user.displayName}`);
      console.log(`      userId: ${member.userId}`);
      console.log(`      RSVP: ${member.rsvpStatus}`);
      console.log(`      Role: ${member.role}`);
      console.log(`      Match current user: ${member.userId === user.id}`);
    });

    console.log();
  });

  // Simulate frontend logic
  console.log("Frontend logic simulation:");
  const currentUserId = user.id;

  trips.forEach((trip) => {
    const myMembership = trip.members.find(m => m.userId === currentUserId);
    console.log(`Trip "${trip.name}":`);
    console.log(`  My membership found: ${!!myMembership}`);
    console.log(`  My RSVP: ${myMembership?.rsvpStatus || "NOT FOUND"}`);
  });

  await prisma.$disconnect();
}

debugApiResponse().catch(console.error);
