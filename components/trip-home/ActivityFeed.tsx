"use client";

import { styles } from "./TripHomeStyles";
import type { ActivityItem, ActionPrompt } from "./types";

interface ActivityFeedProps {
  activities: ActivityItem[];
  prompts: ActionPrompt[];
  totalCount?: number;
  onActivityClick?: (activity: ActivityItem) => void;
  onPromptClick?: (prompt: ActionPrompt) => void;
  onViewAll?: () => void;
}

export function ActivityFeed({
  activities,
  prompts,
  totalCount,
  onActivityClick,
  onPromptClick,
  onViewAll,
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

  // Show the most recent activity
  const topActivity = activities[0];
  const topPrompt = prompts[0];
  const moreCount = (totalCount || activities.length) - 1;

  const hasContent = topActivity || topPrompt;

  if (!hasContent) {
    return null;
  }

  return (
    <section
      className={`${styles.card} col-span-2 mt-auto`}
      aria-label="Activity"
    >
      <div className={styles.cardTop}>
        <span className={styles.cardLabelText}>Activity</span>
        {moreCount > 0 && onViewAll && (
          <button
            className={styles.tileFooterLink}
            onClick={(e) => {
              e.stopPropagation();
              onViewAll();
            }}
          >
            View all
          </button>
        )}
      </div>
      <div className={styles.activityList}>
        {topPrompt && (
          <button
            className={styles.activityItem}
            onClick={() => onPromptClick?.(topPrompt)}
          >
            <div className={styles.activityText}>
              <span className={styles.activityTextStrong}>Action needed:</span>{" "}
              {topPrompt.message}
            </div>
            <div className={styles.activityTime}>now</div>
          </button>
        )}
        {topActivity && (
          <button
            className={styles.activityItem}
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
      </div>
    </section>
  );
}
