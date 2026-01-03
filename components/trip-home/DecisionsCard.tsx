"use client";

import { styles } from "./TripHomeStyles";

interface DecisionsCardProps {
  openCount: number;
  waitingForYou: number;
  topDecision: {
    id: string;
    name: string;
    place: string | null;
    deadline: string | null;
    votedCount: number;
    totalParticipants: number;
    userHasVoted: boolean;
  } | null;
  onClick?: () => void;
  onOpenDecisions?: () => void;
}

export function DecisionsCard({
  openCount,
  waitingForYou,
  topDecision,
  onClick,
  onOpenDecisions,
}: DecisionsCardProps) {
  const raised = waitingForYou > 0;

  const formatDeadline = (deadline: string | null): string | null => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffHours < 0) return "overdue";
    if (diffHours < 24) return `closes ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `closes ${diffDays}d`;
  };

  // Wide card layout matching the mockup
  const cardClasses = [
    styles.card,
    raised && styles.cardRaise,
    styles.cardWide,
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
      <div className={styles.tileHead}>
        <span className={`${styles.cardLabelText} pl-2`}>Decisions</span>
        {waitingForYou > 0 && (
          <span className={styles.cardPill}>
            <span className={styles.cardPillDot("amber")} />
            {waitingForYou} waiting
          </span>
        )}
      </div>

      {topDecision ? (
        <>
          <div className={styles.tilePrimary}>{topDecision.name}</div>
          <div className={styles.tileMeta}>
            {topDecision.place && <span>{topDecision.place}</span>}
            {topDecision.place && topDecision.deadline && <span> · </span>}
            {topDecision.deadline && (
              <span className={styles.tileMetaHighlight}>
                {formatDeadline(topDecision.deadline)}
              </span>
            )}
            {(topDecision.place || topDecision.deadline) && <span> · </span>}
            <span>
              {topDecision.votedCount}/{topDecision.totalParticipants} voted
            </span>
          </div>
        </>
      ) : (
        <div className={styles.tilePrimary}>All up to date</div>
      )}

      <div className={styles.tileFooter}>
        <button
          className={styles.tileFooterLink}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDecisions?.();
          }}
        >
          Open decisions
        </button>
        {openCount > 1 && (
          <>
            <span>·</span>
            <span>+{openCount - 1} more</span>
          </>
        )}
      </div>
    </article>
  );
}
