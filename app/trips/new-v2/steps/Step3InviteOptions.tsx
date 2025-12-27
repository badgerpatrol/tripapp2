"use client";

import clsx from "clsx";
import type { StepProps } from "../types";

// Access levels - same as TripAccessConfig
type AccessLevel = 0 | 1 | 2;
const ACCESS_LEVELS = {
  USERS_ONLY: 0 as AccessLevel,      // No named people, no signup
  NAMED_PEOPLE: 1 as AccessLevel,    // Can add named people (signInMode)
  ALLOW_SIGNUP: 2 as AccessLevel,    // Can add named people + allow signup (signUpMode)
} as const;

function getAccessLevelFromState(allowNamedPeople: boolean, allowSignup: boolean): AccessLevel {
  if (allowSignup) return ACCESS_LEVELS.ALLOW_SIGNUP;
  if (allowNamedPeople) return ACCESS_LEVELS.NAMED_PEOPLE;
  return ACCESS_LEVELS.USERS_ONLY;
}

export default function Step3InviteOptions({
  state,
  updateState,
  error,
}: StepProps) {
  const accessLevel = getAccessLevelFromState(state.allowNamedPeople, state.allowSignup);

  const handleLevelChange = (newLevel: AccessLevel) => {
    switch (newLevel) {
      case ACCESS_LEVELS.USERS_ONLY:
        updateState({ allowNamedPeople: false, allowSignup: false });
        break;
      case ACCESS_LEVELS.NAMED_PEOPLE:
        updateState({ allowNamedPeople: true, allowSignup: false });
        break;
      case ACCESS_LEVELS.ALLOW_SIGNUP:
        updateState({ allowNamedPeople: true, allowSignup: true });
        break;
    }
  };

  const levelLabels = [
    {
      level: ACCESS_LEVELS.USERS_ONLY,
      label: "Users with accounts only",
      description: "Only registered users can access this trip"
    },
    {
      level: ACCESS_LEVELS.NAMED_PEOPLE,
      label: "Named People",
      description: "Show a list of invitees so visitors can identify themselves"
    },
    {
      level: ACCESS_LEVELS.ALLOW_SIGNUP,
      label: "Allow Sign-Up",
      description: "Allow new users to sign up for the trip with their own name"
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

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
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
