"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { user, userProfile } = useAuth();
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
    <header className="bg-white dark:bg-zinc-900 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex justify-between items-center gap-2 min-w-0">
          {/* Left side - Logo */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <span className="text-sm sm:text-base md:text-xl font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap truncate">
              TripPlanner
            </span>
          </div>

          {/* Middle - User display name */}
          {userProfile?.displayName && (
            <div className="flex items-center flex-1 justify-center min-w-0">
              <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 truncate">
                {userProfile.displayName}
              </span>
            </div>
          )}

          {/* Right side - Logout button */}
          <div className="flex items-center flex-shrink-0">
            <Button
              onClick={handleSignOut}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm whitespace-nowrap"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
