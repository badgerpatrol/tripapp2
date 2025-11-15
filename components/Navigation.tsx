"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserRole } from "@/lib/generated/prisma";

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userProfile } = useAuth();

  if (!user) {
    return null;
  }

  const isHomePage = pathname === "/";
  const isKitPage = pathname?.startsWith("/kit") || pathname === "/lists/create-kit";
  const isListsPage = pathname?.startsWith("/lists") && pathname !== "/lists/create-kit";
  const isGroupsPage = pathname?.startsWith("/groups");
  const isUsersPage = pathname?.startsWith("/admin/users");
  const isAdmin = userProfile?.role === UserRole.ADMIN;

  return (
    <nav className="bg-white dark:bg-zinc-900 fixed top-14 left-0 right-0 z-40">
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="flex items-center gap-2">
          {/* Home Button */}
          <button
            onClick={() => router.push("/")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
              isHomePage
                ? "bg-blue-600 text-white"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Home
          </button>

          {/* Lists Button */}
          <button
            onClick={() => router.push("/lists")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
              isListsPage
                ? "bg-blue-600 text-white"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Lists
          </button>

          {/* Kit Button */}
          <button
            onClick={() => router.push("/kit")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
              isKitPage
                ? "bg-blue-600 text-white"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Kit
          </button>

          {/* Groups Button - Only visible to admin users */}
          {isAdmin && (
            <button
              onClick={() => router.push("/groups")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                isGroupsPage
                  ? "bg-blue-600 text-white"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Groups
            </button>
          )}

          {/* Users Button - Only visible to admin users */}
          {isAdmin && (
            <button
              onClick={() => router.push("/admin/users")}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                isUsersPage
                  ? "bg-blue-600 text-white"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Users
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
