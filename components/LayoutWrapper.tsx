"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import Navigation from "./Navigation";
import Header from "./Header";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Only show header/navigation when user is logged in
  // When not logged in on /trips/[id], the page shows password login without nav
  return (
    <>
      {user && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      <main className={user ? "pt-28" : ""}>
        {children}
      </main>
    </>
  );
}
