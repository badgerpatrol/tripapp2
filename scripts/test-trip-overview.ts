/**
 * Manual test script for trip overview API
 *
 * Usage:
 * 1. Start the dev server: pnpm dev
 * 2. Create a trip and get its ID
 * 3. Run: npx tsx scripts/test-trip-overview.ts <firebase-id-token> <trip-id>
 *
 * Or use curl:
 * curl http://localhost:3000/api/trips/TRIP_ID \
 *   -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
 */

async function testTripOverview(idToken: string, tripId: string) {
  const url = `http://localhost:3000/api/trips/${tripId}`;

  console.log(`Fetching trip overview for trip: ${tripId}\n`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
      },
    });

    const data = await response.json();

    console.log("Response status:", response.status);
    console.log("\n=== TRIP OVERVIEW ===\n");
    console.log(JSON.stringify(data, null, 2));

    if (data.trip) {
      const trip = data.trip;

      console.log("\n=== SUMMARY ===");
      console.log(`Trip Name: ${trip.name}`);
      console.log(`Organizer: ${trip.organizer.email}`);
      console.log(`Participants: ${trip.participants.length}`);
      console.log(`Your Role: ${trip.userRole || "Not a member"}`);
      console.log(`Your RSVP: ${trip.userRsvpStatus || "N/A"}`);

      if (trip.timeline) {
        console.log(`\n✅ FULL ACCESS - You can see:`);
        console.log(`  - Timeline items: ${trip.timeline.length}`);
        console.log(`  - Spends: ${trip.spends?.length || 0}`);
        console.log(`  - Total spent: ${trip.baseCurrency} ${trip.totalSpent || 0}`);
        console.log(`  - You owe: ${trip.baseCurrency} ${trip.userOwes || 0}`);
        console.log(`  - You are owed: ${trip.baseCurrency} ${trip.userIsOwed || 0}`);
      } else {
        console.log(`\n⚠️  LIMITED ACCESS - Invitee view only`);
        console.log(`  - You can see: Trip info, organizer, and participant list`);
        console.log(`  - Accept invitation to see spends, timeline, and balances`);
      }

      console.log("\n=== PARTICIPANTS ===");
      trip.participants.forEach((p: any) => {
        console.log(`  - ${p.user.email} (${p.role}, ${p.rsvpStatus})`);
      });

      if (trip.timeline && trip.timeline.length > 0) {
        console.log("\n=== TIMELINE (first 5 items) ===");
        trip.timeline.slice(0, 5).forEach((item: any) => {
          const status = item.isCompleted ? "✓" : " ";
          const date = item.date ? new Date(item.date).toLocaleDateString() : "No date";
          console.log(`  [${status}] ${item.title} - ${date}`);
        });
      }

      if (trip.spends && trip.spends.length > 0) {
        console.log("\n=== RECENT SPENDS ===");
        trip.spends.slice(0, 5).forEach((spend: any) => {
          const date = new Date(spend.date).toLocaleDateString();
          console.log(`  - ${spend.description}: ${spend.currency} ${spend.amount} (paid by ${spend.paidBy.email}) - ${date}`);
        });
      }
    } else if (data.error) {
      console.error("\n❌ Error:", data.error);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

// Get parameters from command line
const overviewToken = process.argv[2];
const tripId = process.argv[3];

if (!overviewToken || !tripId) {
  console.error("Usage: npx tsx scripts/test-trip-overview.ts <firebase-id-token> <trip-id>");
  console.error("\nOr use curl:");
  console.error(`
curl http://localhost:3000/api/trips/TRIP_ID \\
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
  `);
  process.exit(1);
}

testTripOverview(overviewToken, tripId);
