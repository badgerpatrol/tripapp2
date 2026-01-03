"use client";

import { DashboardCard } from "./DashboardCard";
import { styles } from "./TripHomeStyles";

interface PeopleCardProps {
  accepted: number;
  total: number;
  pending: number;
  onClick?: () => void;
}

export function PeopleCard({ accepted, total, pending, onClick }: PeopleCardProps) {
  const pillText = pending > 0 ? `${pending} waiting` : undefined;
  const pillDotColor = pending > 0 ? "amber" : "green";

  return (
    <DashboardCard
      icon="👥"
      label="People"
      pillText={pillText}
      pillDotColor={pillDotColor as "amber" | "green"}
      onClick={onClick}
    >
      <div>
        <div className={styles.cardBig}>
          {accepted}{" "}
          <span className="text-zinc-500 font-bold">/ {total}</span>
        </div>
        <div className={styles.cardMeta}>ready to go</div>
      </div>
    </DashboardCard>
  );
}
