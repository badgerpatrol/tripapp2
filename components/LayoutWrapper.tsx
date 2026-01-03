"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import Navigation from "./Navigation";
import Header from "./Header";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // Hide header/nav for trip home page (full-screen mobile experience)
  const isTripHomePage = pathname?.match(/^\/trips\/[^/]+\/home$/);

  // Only show header/navigation when user is logged in and not on trip home page
  // When not logged in on /trips/[id], the page shows password login without nav
  return (
    <>
      {user && !isTripHomePage && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      <main className={user && !isTripHomePage ? "pt-28" : ""}>
        {children}
      </main>
    </>
  );
}
