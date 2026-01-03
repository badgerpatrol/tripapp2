"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface KitCardProps {
  totalItems: number;
  completedItems: number;
  topIncomplete: string[];
  onClick?: () => void;
}

export function KitCard({
  totalItems,
  completedItems,
  topIncomplete,
  onClick,
}: KitCardProps) {
  const remaining = totalItems - completedItems;
  const pillText = remaining > 0 ? `${remaining} left` : undefined;
  const pillDotColor = remaining > 0 ? "green" : "green";

  // Truncate item names for display
  const truncateItem = (item: string, maxLen: number = 10) =>
    item.length > maxLen ? item.slice(0, maxLen) + "…" : item;

  const displayItems = topIncomplete.slice(0, 2).map((i) => truncateItem(i));

  return (
    <DashboardCard
      icon="🎒"
      label="Kit"
      pillText={pillText}
      pillDotColor={pillDotColor as "green"}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className={styles.cardBig}>{remaining}</div>
        <div className={styles.cardMeta}>
          {displayItems.length > 0 ? displayItems.join(" · ") : "All packed"}
        </div>
      </div>
    </DashboardCard>
  );
}
