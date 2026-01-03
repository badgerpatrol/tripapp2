"use client";

import { styles } from "./TripHomeStyles";
import type { ActivityItem, ActionPrompt } from "./types";

interface ActivityFeedProps {
  activities: ActivityItem[];
  prompts: ActionPrompt[];
  onActivityClick?: (activity: ActivityItem) => void;
  onPromptClick?: (prompt: ActionPrompt) => void;
}

export function ActivityFeed({
  activities,
  prompts,
  onActivityClick,
  onPromptClick,
}: ActivityFeedProps) {
  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    return `${diffDays}d ago`;
  };

  // Show at most 2 items (1 prompt if exists + 1 activity)
  const topPrompt = prompts[0];
  const topActivity = activities[0];

  return (
    <section className={styles.activityPeek} aria-label="Activity preview">
      {topActivity && (
        <button
          className={styles.activityRow}
          onClick={() => onActivityClick?.(topActivity)}
        >
          <div className={styles.activityText}>
            <span className={styles.activityTextStrong}>
              {topActivity.actorName || "Someone"}
            </span>{" "}
            {topActivity.action}
          </div>
          <div className={styles.activityTime}>
            {formatTimeAgo(topActivity.timestamp)}
          </div>
        </button>
      )}
      {topPrompt && (
        <button
          className={styles.activityRow}
          onClick={() => onPromptClick?.(topPrompt)}
        >
          <div className={styles.activityText}>
            To keep things moving:{" "}
            <span className={styles.activityTextStrong}>{topPrompt.message}</span>
          </div>
          <div className={styles.activityTime}>now</div>
        </button>
      )}
    </section>
  );
}
