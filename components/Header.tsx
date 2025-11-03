"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

interface HeaderProps {
  showBackButton?: boolean;
}

export default function Header({ showBackButton = false }: HeaderProps) {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex justify-between items-center gap-2">
          {/* Left side - Logo */}
          <div className="flex items-center flex-shrink-0">
            <a href="/trips" className="text-sm sm:text-base md:text-xl font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
              TripPlanner
            </a>
          </div>

          {/* Center - Back to Trips button */}
          {showBackButton && (
            <div className="flex-shrink-0">
              <a
                href="/trips"
                className="tap-target px-2 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-1 text-xs sm:text-sm"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="whitespace-nowrap">Trips</span>
              </a>
            </div>
          )}

          {/* Right side - Logout button only */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={handleSignOut}
              className="tap-target px-2 py-1.5 sm:px-4 sm:py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
