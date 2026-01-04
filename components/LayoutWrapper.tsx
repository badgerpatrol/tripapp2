"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Navigation from "./Navigation";
import Header from "./Header";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide header/nav for new trip pages (full-screen mobile experience)
  // Matches: /trips/[id]/home, /trips/[id]/decisions, /trips/[id]/spend, /trips/[id]/tasks, /trips/[id]/kit, /trips/[id]/people
  const isNewTripPage = pathname?.match(/^\/trips\/[^/]+\/(home|decisions|spend|tasks|kit|people)$/);

  // Only show header/navigation when user is logged in and not on new trip pages
  // When not logged in on /trips/[id], the page shows password login without nav
  return (
    <>
      {user && !isNewTripPage && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      <main className={user && !isNewTripPage ? "pt-28" : ""}>
        {children}
      </main>
    </>
  );
}
