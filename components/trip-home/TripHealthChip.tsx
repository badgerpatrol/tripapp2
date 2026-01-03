"use client";

import { styles } from "./TripHomeStyles";

interface TripHealthChipProps {
  status: "on_track" | "needs_attention" | "blocked";
  onClick?: () => void;
}

const statusLabels: Record<string, string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  blocked: "Blocked",
};

export function TripHealthChip({ status, onClick }: TripHealthChipProps) {
  return (
    <button className={styles.chip} onClick={onClick} title="Trip health">
      <span className={styles.chipDot(status)} />
      <span>{statusLabels[status]}</span>
    </button>
  );
}
