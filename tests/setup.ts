import "@testing-library/jest-dom/vitest";

// Mock environment variables for tests
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "test.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
process.env.NEXT_PUBLIC_RP_ID = "localhost";
process.env.NEXT_PUBLIC_ORIGIN = "http://localhost:3000";
// Use local development database for tests
process.env.DATABASE_URL = "postgresql://mikeprince@localhost:5432/tripplanner?schema=public";
