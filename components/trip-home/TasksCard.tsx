"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface TasksCardProps {
  openCount: number;
  topTasks: string[];
  onClick?: () => void;
}

export function TasksCard({ openCount, topTasks, onClick }: TasksCardProps) {
  const pillText = openCount > 0 ? `${openCount} open` : undefined;
  const pillDotColor = openCount > 0 ? "amber" : "green";

  // Truncate task names for display
  const truncateTask = (task: string, maxLen: number = 12) =>
    task.length > maxLen ? task.slice(0, maxLen) + "…" : task;

  const displayTasks = topTasks.slice(0, 2).map((t) => truncateTask(t));

  return (
    <DashboardCard
      icon="✓"
      label="Tasks"
      pillText={pillText}
      pillDotColor={pillDotColor as "amber" | "green"}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className={styles.cardBig}>{openCount}</div>
        <div className={styles.cardMeta}>
          {displayTasks.length > 0 ? displayTasks.join(" · ") : "All done"}
        </div>
      </div>
    </DashboardCard>
  );
}
