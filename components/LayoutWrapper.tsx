"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import Navigation from "./Navigation";
import Header from "./Header";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <>
      {user && (
        <>
          <Header />
          <Navigation />
        </>
      )}
      {children}
    </>
  );
}
