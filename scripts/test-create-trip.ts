/**
 * Manual test script for trip creation API
 *
 * Usage:
 * 1. Start the dev server: pnpm dev
 * 2. Get a Firebase ID token from a logged-in user
 * 3. Run: npx tsx scripts/test-create-trip.ts <firebase-id-token>
 *
 * Or use curl:
 * curl -X POST http://localhost:3000/api/trips \
 *   -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"Test Trip","baseCurrency":"USD","startDate":"2025-06-01","endDate":"2025-06-10"}'
 */

async function testCreateTrip(idToken: string) {
  const url = "http://localhost:3000/api/trips";

  const testData = {
    name: "Summer Vacation 2025",
    description: "Beach trip with friends",
    baseCurrency: "USD",
    startDate: "2025-06-01",
    endDate: "2025-06-10",
  };

  console.log("Creating trip with data:", testData);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();

    console.log("\nResponse status:", response.status);
    console.log("Response body:", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("\n✅ Event created successfully!");
      console.log("Trip ID:", data.trip.id);

      // Test GET endpoint
      console.log("\n--- Testing GET /api/trips ---");
      const getResponse = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      const trips = await getResponse.json();
      console.log("User trips:", JSON.stringify(trips, null, 2));
    } else {
      console.error("\n❌ Failed to create trip:", data.error);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

// Get token from command line
const createTripToken = process.argv[2];

if (!createTripToken) {
  console.error("Usage: npx tsx scripts/test-create-trip.ts <firebase-id-token>");
  console.error("\nOr use curl:");
  console.error(`
curl -X POST http://localhost:3000/api/trips \\
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test Trip","baseCurrency":"USD","startDate":"2025-06-01","endDate":"2025-06-10"}'
  `);
  process.exit(1);
}

testCreateTrip(createTripToken);
