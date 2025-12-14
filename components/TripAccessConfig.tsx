"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

// Access levels from bottom to top
export type AccessLevel = 0 | 1 | 2;
export const ACCESS_LEVELS = {
  USERS_ONLY: 0 as AccessLevel,      // No password, no signin, no signup
  NAMED_PEOPLE: 1 as AccessLevel,    // Password + signin mode
  ALLOW_SIGNUP: 2 as AccessLevel,    // Password + signup mode
} as const;

interface TripAccessConfigProps {
  // Current values
  signInMode: boolean;
  signUpMode: boolean;
  signUpPassword: string;
  // Callbacks
  onAccessChange: (config: {
    signInMode: boolean;
    signUpMode: boolean;
    signUpPassword: string;
  }) => void;
  // Display password (for edit mode showing current password)
  currentPassword?: string | null;
  // Mode: 'create' for new trips, 'edit' for existing trips
  mode?: "create" | "edit";
}

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getAccessLevelFromModes(signInMode: boolean, signUpMode: boolean, hasPassword: boolean): AccessLevel {
  if (signUpMode) return ACCESS_LEVELS.ALLOW_SIGNUP;
  if (signInMode) return ACCESS_LEVELS.NAMED_PEOPLE;
  return ACCESS_LEVELS.USERS_ONLY;
}

export default function TripAccessConfig({
  signInMode,
  signUpMode,
  signUpPassword,
  onAccessChange,
  currentPassword,
  mode = "edit",
}: TripAccessConfigProps) {
  // Determine initial level from props
  const initialLevel = getAccessLevelFromModes(signInMode, signUpMode, !!signUpPassword || !!currentPassword);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(initialLevel);
  const [password, setPassword] = useState(signUpPassword || currentPassword || "");
  const [hasGeneratedPassword, setHasGeneratedPassword] = useState(false);

  // Track if we've ever been above level 0 (to know if we should keep the password)
  const [hasMovedUpFromBottom, setHasMovedUpFromBottom] = useState(
    initialLevel > ACCESS_LEVELS.USERS_ONLY || !!currentPassword
  );

  // Sync external changes
  useEffect(() => {
    const newLevel = getAccessLevelFromModes(signInMode, signUpMode, !!signUpPassword || !!currentPassword);
    setAccessLevel(newLevel);
    if (signUpPassword) {
      setPassword(signUpPassword);
    } else if (currentPassword && !password) {
      setPassword(currentPassword);
    }
  }, [signInMode, signUpMode, signUpPassword, currentPassword]);

  const handleLevelChange = useCallback((newLevel: AccessLevel) => {
    const previousLevel = accessLevel;
    setAccessLevel(newLevel);

    let newPassword = password;

    // If moving up from bottom for the first time and no password exists
    if (previousLevel === ACCESS_LEVELS.USERS_ONLY && newLevel > ACCESS_LEVELS.USERS_ONLY) {
      if (!password && !currentPassword) {
        newPassword = generateSixDigitCode();
        setPassword(newPassword);
        setHasGeneratedPassword(true);
      }
      setHasMovedUpFromBottom(true);
    }

    // Compute new modes
    let newSignInMode = false;
    let newSignUpMode = false;
    let passwordToSend = "";

    switch (newLevel) {
      case ACCESS_LEVELS.USERS_ONLY:
        // No modes enabled, clear password
        newSignInMode = false;
        newSignUpMode = false;
        passwordToSend = "";
        break;
      case ACCESS_LEVELS.NAMED_PEOPLE:
        // Sign-in mode only
        newSignInMode = true;
        newSignUpMode = false;
        passwordToSend = newPassword;
        break;
      case ACCESS_LEVELS.ALLOW_SIGNUP:
        // Sign-up mode only
        newSignInMode = false;
        newSignUpMode = true;
        passwordToSend = newPassword;
        break;
    }

    onAccessChange({
      signInMode: newSignInMode,
      signUpMode: newSignUpMode,
      signUpPassword: passwordToSend,
    });
  }, [accessLevel, password, currentPassword, onAccessChange]);

  const handlePasswordChange = useCallback((newPassword: string) => {
    setPassword(newPassword);
    setHasGeneratedPassword(false);

    // Only send if we're above level 0
    if (accessLevel > ACCESS_LEVELS.USERS_ONLY) {
      onAccessChange({
        signInMode: accessLevel === ACCESS_LEVELS.NAMED_PEOPLE,
        signUpMode: accessLevel === ACCESS_LEVELS.ALLOW_SIGNUP,
        signUpPassword: newPassword,
      });
    }
  }, [accessLevel, onAccessChange]);

  const levelLabels = [
    { level: ACCESS_LEVELS.USERS_ONLY, label: "Users with accounts only", description: "Only registered users can access this trip" },
    { level: ACCESS_LEVELS.NAMED_PEOPLE, label: "Named People", description: "Show a list of invitees so visitors can identify themselves" },
    { level: ACCESS_LEVELS.ALLOW_SIGNUP, label: "Allow Sign-Up", description: "Allow new users to sign up for the trip with their own name" },
  ];

  const showPasswordField = accessLevel > ACCESS_LEVELS.USERS_ONLY;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Access
      </label>

      <div className="flex gap-6 items-stretch">
        {/* Vertical Slider */}
        <div className="flex flex-col items-center py-2">
          <div className="relative h-32 w-12 flex flex-col items-center justify-between">
            {/* Track */}
            <div className="absolute left-1/2 -translate-x-1/2 w-2 h-full bg-zinc-200 dark:bg-zinc-700 rounded-full">
              {/* Filled portion */}
              <div
                className="absolute bottom-0 w-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ height: `${(accessLevel / 2) * 100}%` }}
              />
            </div>

            {/* Tick marks and clickable areas */}
            {[2, 1, 0].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleLevelChange(level as AccessLevel)}
                className={clsx(
                  "relative z-10 w-6 h-6 rounded-full border-2 transition-all duration-200 tap-target",
                  accessLevel === level
                    ? "bg-blue-500 border-blue-500 scale-110"
                    : accessLevel > level
                    ? "bg-blue-500 border-blue-500"
                    : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 hover:border-blue-400"
                )}
                aria-label={levelLabels.find(l => l.level === level)?.label}
              >
                {accessLevel === level && (
                  <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-25" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="flex-1 flex flex-col justify-between py-2">
          {[2, 1, 0].map((level) => {
            const levelInfo = levelLabels.find(l => l.level === level)!;
            const isActive = accessLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => handleLevelChange(level as AccessLevel)}
                className={clsx(
                  "text-left py-1 transition-all tap-target",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                <span className={clsx(
                  "block text-sm font-medium",
                  isActive && "font-semibold"
                )}>
                  {levelInfo.label}
                </span>
                {isActive && (
                  <span className="block text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">
                    {levelInfo.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Password Field - only shown when above level 0 */}
      {showPasswordField && (
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <label
            htmlFor="accessPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Access Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="accessPassword"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Enter 6+ character code"
              minLength={6}
              className={clsx(
                "tap-target flex-1 min-w-0 appearance-none h-10 px-4 py-3 rounded-lg box-border",
                "bg-white dark:bg-zinc-800",
                "border border-zinc-300 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100 font-mono text-lg tracking-wider",
                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "transition-colors"
              )}
            />
            <button
              type="button"
              onClick={() => {
                const newCode = generateSixDigitCode();
                setPassword(newCode);
                setHasGeneratedPassword(true);
                if (accessLevel > ACCESS_LEVELS.USERS_ONLY) {
                  onAccessChange({
                    signInMode: accessLevel === ACCESS_LEVELS.NAMED_PEOPLE,
                    signUpMode: accessLevel === ACCESS_LEVELS.ALLOW_SIGNUP,
                    signUpPassword: newCode,
                  });
                }
              }}
              className="tap-target px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1"
              title="Generate new code"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Share this code with people who need access. Minimum 6 characters.
          </p>
          {hasGeneratedPassword && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Code auto-generated. You can change it if you prefer.
            </p>
          )}
          {mode === "edit" && currentPassword && currentPassword !== password && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Current code: <code className="bg-zinc-200 dark:bg-zinc-600 px-1 py-0.5 rounded">{currentPassword}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
