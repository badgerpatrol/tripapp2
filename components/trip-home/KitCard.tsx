"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface KitCardProps {
  totalItems: number;
  completedItems: number;
  topIncomplete?: string[];
  onClick?: () => void;
}

export function KitCard({
  totalItems,
  completedItems,
  onClick,
}: KitCardProps) {
  const remaining = totalItems - completedItems;
  const pillText = remaining > 0 ? `${remaining} left` : undefined;
  const pillDotColor = "green";

  return (
    <DashboardCard
      icon="🎒"
      label="Kit"
      pillText={pillText}
      pillDotColor={pillDotColor}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className={styles.cardBig}>{completedItems}/{totalItems}</div>
        <div className={styles.cardMeta}>
          {remaining > 0 ? "packed" : "All packed"}
        </div>
      </div>
    </DashboardCard>
  );
}
