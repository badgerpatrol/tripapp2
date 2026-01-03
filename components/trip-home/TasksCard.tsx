"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface TasksCardProps {
  openCount: number;
  totalCount: number;
  topTasks?: string[];
  onClick?: () => void;
}

export function TasksCard({ openCount, totalCount, onClick }: TasksCardProps) {
  const completedCount = totalCount - openCount;
  const pillText = openCount > 0 ? `${openCount} open` : undefined;
  const pillDotColor = openCount > 0 ? "amber" : "green";

  return (
    <DashboardCard
      icon="✓"
      label="Tasks"
      pillText={pillText}
      pillDotColor={pillDotColor as "amber" | "green"}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className={styles.cardBig}>{completedCount}/{totalCount}</div>
        <div className={styles.cardMeta}>
          {openCount > 0 ? "done" : "All done"}
        </div>
      </div>
    </DashboardCard>
  );
}
