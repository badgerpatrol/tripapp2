"use client";

import { styles } from "./TripHomeStyles";

interface DashboardCardProps {
  icon: string;
  label: string;
  pillText?: string;
  pillDotColor?: "amber" | "green" | "blue";
  raised?: boolean;
  wide?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function DashboardCard({
  icon,
  label,
  pillText,
  pillDotColor = "amber",
  raised = false,
  wide = false,
  onClick,
  children,
}: DashboardCardProps) {
  const cardClasses = [
    styles.card,
    raised && styles.cardRaise,
    wide && styles.cardWide,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cardClasses}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardLabelText}>{label}</span>
        {pillText && (
          <span className={styles.cardPill}>
            <span className={styles.cardPillDot(pillDotColor)} />
            {pillText}
          </span>
        )}
      </div>
      {children}
    </article>
  );
}
