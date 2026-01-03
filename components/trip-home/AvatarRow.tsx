"use client";

import { styles, getAvatarColor, getInitials, avatarColors } from "./TripHomeStyles";
import type { Participant } from "./types";

interface AvatarRowProps {
  participants: Participant[];
  maxVisible?: number;
  onAvatarClick?: (participant: Participant) => void;
}

export function AvatarRow({
  participants,
  maxVisible = 6,
  onAvatarClick,
}: AvatarRowProps) {
  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;

  const getRsvpBadge = (status: string): { type: "ok" | "warn" | "no"; icon: string } => {
    switch (status) {
      case "ACCEPTED":
        return { type: "ok", icon: "✓" };
      case "PENDING":
      case "MAYBE":
        return { type: "warn", icon: "!" };
      case "DECLINED":
        return { type: "no", icon: "✗" };
      default:
        return { type: "no", icon: "?" };
    }
  };

  const getRingStatus = (status: string): "accepted" | "pending" | "declined" | "maybe" | "none" => {
    switch (status) {
      case "ACCEPTED":
        return "accepted";
      case "PENDING":
        return "pending";
      case "MAYBE":
        return "maybe";
      case "DECLINED":
        return "declined";
      default:
        return "none";
    }
  };

  return (
    <section className={styles.avatars} aria-label="People pulse">
      {visible.map((participant, index) => {
        const badge = getRsvpBadge(participant.rsvpStatus);
        const ringStatus = getRingStatus(participant.rsvpStatus);

        return (
          <button
            key={participant.id}
            className={`${styles.avatar(getAvatarColor(index))} ${styles.avatarRing(ringStatus)}`}
            onClick={() => onAvatarClick?.(participant)}
            title={`${participant.displayName || "Unknown"} - ${participant.rsvpStatus}`}
          >
            {participant.photoURL ? (
              <img
                src={participant.photoURL}
                alt={participant.displayName || "User"}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(participant.displayName)
            )}
            <span className={styles.avatarBadge(badge.type)}>{badge.icon}</span>
          </button>
        );
      })}
      {overflow > 0 && (
        <div
          className={`${styles.avatar(avatarColors[5])} ${styles.avatarRing("none")}`}
          title={`+${overflow} more`}
        >
          +{overflow}
          <span className={styles.avatarBadge("no")}>•</span>
        </div>
      )}
    </section>
  );
}
