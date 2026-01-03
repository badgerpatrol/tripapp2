/**
 * Trip Home Dashboard Styles
 * CSS-in-JS styles matching the mockup design
 */

export const styles = {
  // Container
  container: `
    max-w-[430px] mx-auto min-h-screen flex flex-col gap-3.5 px-2.5 py-3.5
  `,

  // Top bar
  topbar: `px-1.5 pt-1.5 pb-0.5 flex flex-col gap-1.5`,
  titleRow: `flex justify-between gap-2.5 items-start`,
  tripTitle: `text-[22px] leading-tight font-bold tracking-wide text-zinc-100`,
  subTitle: `text-[13.5px] tracking-wide text-zinc-400`,

  // Health chip
  chip: `
    inline-flex items-center gap-2 px-3 py-2.5 rounded-full
    border border-zinc-700/90 bg-zinc-800/55 text-zinc-400
    text-[12.5px] min-h-[40px] select-none whitespace-nowrap
  `,
  chipDot: (status: "on_track" | "needs_attention" | "blocked") => {
    const colors = {
      on_track: "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.1)]",
      needs_attention: "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.1)]",
      blocked: "bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.1)]",
    };
    return `w-2 h-2 rounded-full ${colors[status]}`;
  },

  // Avatars
  avatars: `flex gap-2.5 px-1.5 pt-1 pb-0.5 overflow-x-auto scrollbar-hide`,
  avatar: (color: string) => `
    relative w-[46px] h-[46px] rounded-full flex items-center justify-center
    font-bold tracking-wide select-none flex-shrink-0
    ${color}
  `,
  avatarRing: (status: "accepted" | "pending" | "declined" | "maybe" | "none") => {
    const rings = {
      accepted: "ring-2 ring-emerald-400/95 ring-offset-2 ring-offset-zinc-950",
      pending: "ring-2 ring-amber-400/95 ring-offset-2 ring-offset-zinc-950",
      maybe: "ring-2 ring-amber-400/95 ring-offset-2 ring-offset-zinc-950",
      declined: "ring-2 ring-zinc-500/35 ring-offset-2 ring-offset-zinc-950",
      none: "ring-2 ring-zinc-600/25 ring-offset-2 ring-offset-zinc-950",
    };
    return rings[status];
  },
  avatarBadge: (type: "ok" | "warn" | "no") => {
    const badges = {
      ok: "bg-emerald-400/95 text-emerald-950",
      warn: "bg-amber-400/95 text-amber-950",
      no: "bg-zinc-600/35 text-zinc-100",
    };
    return `
      absolute -right-0.5 -bottom-0.5 w-[18px] h-[18px] rounded-full
      flex items-center justify-center text-xs
      border-2 border-zinc-950
      ${badges[type]}
    `;
  },

  // Grid
  grid: `grid grid-cols-2 gap-3 px-1`,

  // Cards
  card: `
    bg-zinc-800/96 border border-zinc-700/95 rounded-[22px]
    p-3.5 pb-3 shadow-lg min-h-[118px]
    flex flex-col justify-between cursor-pointer select-none
    transition-all duration-150 active:scale-[0.99]
  `,
  cardRaise: `
    bg-zinc-800/98 border-amber-500/35
    shadow-[0_0_0_1px_rgba(245,158,11,0.1),0_18px_50px_rgba(0,0,0,0.45)]
    -translate-y-0.5
  `,
  cardWide: `
    col-span-2 min-h-[132px] relative overflow-hidden
    before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5
    before:bg-gradient-to-b before:from-blue-500 before:to-blue-500/55 before:opacity-95
  `,
  cardTop: `flex justify-between gap-2 items-center`,
  cardLabelText: `text-[13px] text-zinc-400 tracking-wide font-semibold`,
  cardPill: `
    text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700/95
    text-zinc-400 bg-zinc-950/35 inline-flex gap-1 items-center whitespace-nowrap flex-shrink-0
  `,
  cardPillDot: (color: "amber" | "green" | "blue") => {
    const colors = {
      amber: "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.14)]",
      green: "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]",
      blue: "bg-blue-400 shadow-[0_0_0_4px_rgba(96,165,250,0.14)]",
    };
    return `w-2 h-2 rounded-full ${colors[color]}`;
  },
  cardBig: `text-[26px] font-extrabold tracking-wide leading-none text-zinc-100`,
  cardBigSmall: `text-[22px] font-extrabold tracking-wide leading-none text-zinc-100`,
  cardBigAmber: `text-amber-400`,
  cardMeta: `text-[12px] text-zinc-500 leading-snug line-clamp-2 overflow-hidden`,
  cardSmall: `text-[13px] text-zinc-400 leading-snug`,

  // Wide card (decisions) tile layout
  tileHead: `flex items-center justify-between gap-2.5`,
  tilePill: `
    inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full
    border border-zinc-700/92 bg-zinc-800/58 text-zinc-400
    text-[12.5px] whitespace-nowrap flex-shrink-0
  `,
  tilePrimary: `mt-3.5 text-[22px] font-extrabold tracking-tight leading-tight text-zinc-100`,
  tileMeta: `mt-2 text-[13.5px] text-zinc-400 leading-snug`,
  tileMetaHighlight: `text-amber-400 font-bold`,
  tileFooter: `mt-3.5 text-[12.5px] text-zinc-500 flex items-center gap-2 flex-wrap`,
  tileFooterLink: `text-blue-400 no-underline font-bold cursor-pointer hover:text-blue-300`,

  // Activity
  activityPeek: `mt-auto px-1 pt-1.5 flex flex-col gap-2.5`,
  activityRow: `
    flex justify-between gap-2.5 items-center
    px-3.5 py-3 rounded-[18px] border border-zinc-700/90 bg-zinc-800/55
    cursor-pointer select-none
  `,
  activityText: `text-[13.5px] text-zinc-400 leading-snug`,
  activityTextStrong: `text-zinc-100 font-bold`,
  activityTime: `text-zinc-500 text-xs whitespace-nowrap`,

  // Bottom tabs
  tabs: `
    sticky bottom-0 pb-[env(safe-area-inset-bottom)]
    flex gap-2.5 justify-between
    bg-gradient-to-t from-zinc-950/92 via-zinc-950/85 to-transparent
    pt-2.5 mt-1.5
  `,
  tab: (active: boolean) => `
    flex-1 min-h-[52px] rounded-[18px] border border-zinc-700/85 bg-zinc-800/55
    flex justify-center items-center gap-2 text-zinc-400 text-[12.5px] select-none
    ${active ? "bg-blue-500/16 border-blue-500/35 text-zinc-100" : ""}
  `,
};

// Avatar color palette
export const avatarColors = [
  "bg-gradient-to-b from-blue-500/95 to-blue-500/55 text-white",
  "bg-gradient-to-b from-purple-500/95 to-purple-500/55 text-white",
  "bg-gradient-to-b from-emerald-400/95 to-emerald-400/55 text-emerald-950",
  "bg-gradient-to-b from-amber-400/95 to-amber-400/55 text-amber-950",
  "bg-gradient-to-b from-pink-500/95 to-pink-500/55 text-white",
  "bg-gradient-to-b from-zinc-500/70 to-zinc-500/35 text-zinc-950",
];

export function getAvatarColor(index: number): string {
  return avatarColors[index % avatarColors.length];
}

export function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
