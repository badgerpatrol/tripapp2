"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { styles, avatarColors, getInitials } from "./TripHomeStyles";

interface UserAvatarMenuProps {
  displayName: string | null;
  photoURL: string | null;
}

export function UserAvatarMenu({ displayName, photoURL }: UserAvatarMenuProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const initials = getInitials(displayName);
  // Use a consistent color for the current user (first color in palette)
  const avatarColor = avatarColors[0];

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`${styles.avatar(avatarColor)} cursor-pointer hover:opacity-90 transition-opacity`}
        aria-label="User menu"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName || "User"}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2.5 text-left text-[12px] text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
