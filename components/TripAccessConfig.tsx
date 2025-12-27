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
}: TripAccessConfigProps) {
  // Determine initial level from props
  const initialLevel = getAccessLevelFromModes(signInMode, signUpMode, !!signUpPassword || !!currentPassword);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(initialLevel);
  const [password, setPassword] = useState(signUpPassword || currentPassword || "");

  // Track if we've ever been above level 0 (to know if we should keep the password)
  const [hasMovedUpFromBottom, setHasMovedUpFromBottom] = useState(
    initialLevel > ACCESS_LEVELS.USERS_ONLY || !!currentPassword
  );

  // Track if the code was just copied
  const [codeCopied, setCodeCopied] = useState(false);

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

  const levelLabels = [
    { level: ACCESS_LEVELS.USERS_ONLY, label: "Users with accounts only", description: "Only registered users can access this trip", security: { label: "Most Secure", color: "text-green-600 dark:text-green-400" } },
    { level: ACCESS_LEVELS.NAMED_PEOPLE, label: "Named People", description: "Show a list of invitees so visitors can identify themselves", security: { label: "Less Secure", color: "text-yellow-600 dark:text-yellow-400" } },
    { level: ACCESS_LEVELS.ALLOW_SIGNUP, label: "Allow Sign-Up", description: "Allow new users to sign up for the trip with their own name", security: { label: "Wild West", color: "text-red-600 dark:text-red-400" } },
  ];

  const showPasswordField = accessLevel > ACCESS_LEVELS.USERS_ONLY;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Access
      </label>

      {/* Radio buttons - vertical list, highest option at top */}
      <div className="space-y-3">
        {[...levelLabels].reverse().map((levelInfo) => {
          const isActive = accessLevel === levelInfo.level;
          return (
            <label
              key={levelInfo.level}
              className={clsx(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                isActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
              )}
            >
              <input
                type="radio"
                name="accessLevel"
                value={levelInfo.level}
                checked={isActive}
                onChange={() => handleLevelChange(levelInfo.level)}
                className="mt-0.5 h-4 w-4 text-blue-600 border-zinc-300 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div className="flex-1">
                <span className={clsx(
                  "block text-sm font-medium",
                  isActive
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-zinc-700 dark:text-zinc-300"
                )}>
                  {levelInfo.label}
                </span>
                <span className="block text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">
                  {levelInfo.description}
                </span>
              </div>
              <span className={clsx("text-xs font-medium whitespace-nowrap", levelInfo.security.color)}>
                {levelInfo.security.label}
              </span>
            </label>
          );
        })}
      </div>

      {/* Access Code - only shown when above level 0 */}
      {showPasswordField && (
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Access Code
          </label>
          <div className="flex gap-3 items-center">
            <span className="font-mono text-xl tracking-wider text-zinc-900 dark:text-zinc-100">
              {password || <span className="text-zinc-400 dark:text-zinc-500 text-base font-sans">No code set</span>}
            </span>
            {password && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(password);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                className="tap-target px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
                title="Copy code"
              >
                {codeCopied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const newCode = generateSixDigitCode();
                setPassword(newCode);
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
            Share this code with people who need access. Click the button to generate a new code.
          </p>
        </div>
      )}
    </div>
  );
}
