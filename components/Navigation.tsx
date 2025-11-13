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
  const isListsPage = pathname?.startsWith("/lists");
  const isGroupsPage = pathname?.startsWith("/groups");
  const isUsersPage = pathname?.startsWith("/admin/users");
  const isAdmin = userProfile?.role === UserRole.ADMIN;

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 fixed top-14 left-0 right-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex items-center gap-4">
          {/* Home Button */}
          <button
            onClick={() => router.push("/")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isHomePage
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Home
          </button>

          {/* Lists Button */}
          <button
            onClick={() => router.push("/lists")}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isListsPage
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Lists
          </button>

          {/* Groups Button - Only visible to admin users */}
          {isAdmin && (
            <button
              onClick={() => router.push("/groups")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isGroupsPage
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Groups
            </button>
          )}

          {/* Users Button - Only visible to admin users */}
          {isAdmin && (
            <button
              onClick={() => router.push("/admin/users")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isUsersPage
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
