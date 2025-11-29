"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import Header from "./Header";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // Check if this is a standalone trip route (e.g., /t/trip-id)
  const isStandaloneTripRoute = pathname?.startsWith('/t/');

  return (
    <>
      {user && !isStandaloneTripRoute && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      <main className={user && !isStandaloneTripRoute ? "pt-28" : ""}>
        {children}
      </main>
    </>
  );
}
