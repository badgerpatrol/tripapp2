/**
 * Trip Home Dashboard Styles
 * CSS-in-JS styles matching the mockup design
 */

export const styles = {
  // Container
  container: `max-w-[430px] mx-auto min-h-screen flex flex-col gap-1.5 px-2 py-1.5`,

  // Top bar
  topbar: `px-1 pt-0.5 pb-0 flex flex-col gap-0.5`,
  titleRow: `flex justify-between gap-2 items-start`,
  tripTitle: `text-[18px] leading-none font-bold tracking-wide text-zinc-100`,
  subTitle: `text-[11px] leading-tight tracking-wide text-zinc-400`,

  // Health chip
  chip: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-zinc-700/90 bg-zinc-800/55 text-zinc-400 text-[10px] select-none whitespace-nowrap`,
  chipDot: (status: "on_track" | "needs_attention" | "blocked") => {
    const colors = {
      on_track: "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.1)]",
      needs_attention: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.1)]",
      blocked: "bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.1)]",
    };
    return `w-1.5 h-1.5 rounded-full ${colors[status]}`;
  },

  // Avatars
  avatars: `flex gap-1.5 px-1 py-1 overflow-x-auto scrollbar-hide`,
  avatar: (color: string) => `relative w-[34px] h-[34px] rounded-full flex items-center justify-center font-bold tracking-wide select-none flex-shrink-0 text-[11px] ${color}`,
  avatarRing: (status: "accepted" | "pending" | "declined" | "maybe" | "none") => {
    const rings = {
      accepted: "ring-[1.5px] ring-emerald-400/95 ring-offset-[1.5px] ring-offset-zinc-950",
      pending: "ring-[1.5px] ring-amber-400/95 ring-offset-[1.5px] ring-offset-zinc-950",
      maybe: "ring-[1.5px] ring-amber-400/95 ring-offset-[1.5px] ring-offset-zinc-950",
      declined: "ring-[1.5px] ring-zinc-500/35 ring-offset-[1.5px] ring-offset-zinc-950",
      none: "ring-[1.5px] ring-zinc-600/25 ring-offset-[1.5px] ring-offset-zinc-950",
    };
    return rings[status];
  },
  avatarBadge: (type: "ok" | "warn" | "no") => {
    const badges = {
      ok: "bg-emerald-400/95 text-emerald-950",
      warn: "bg-amber-400/95 text-amber-950",
      no: "bg-zinc-600/35 text-zinc-100",
    };
    return `absolute -right-0.5 -bottom-0.5 w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] border-[1.5px] border-zinc-950 ${badges[type]}`;
  },

  // Grid
  grid: `grid grid-cols-2 gap-1.5 px-0.5`,

  // Cards
  card: `bg-zinc-800/96 border border-zinc-700/95 rounded-[14px] p-2.5 shadow-lg min-h-[85px] flex flex-col cursor-pointer select-none transition-all duration-150 active:scale-[0.99]`,
  cardContent: `flex-1 flex flex-col justify-center`,
  cardRaise: `bg-zinc-800/98 border-amber-500/35 shadow-[0_0_0_1px_rgba(245,158,11,0.1),0_14px_40px_rgba(0,0,0,0.45)] -translate-y-0.5`,
  cardWide: `col-span-2 min-h-[90px] relative overflow-hidden before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-blue-500 before:to-blue-500/55 before:opacity-95`,
  cardTop: `flex justify-between gap-1.5 items-center`,
  cardLabelText: `text-[11px] text-zinc-400 tracking-wide font-semibold`,
  cardPill: `text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700/95 text-zinc-400 bg-zinc-950/35 inline-flex gap-0.5 items-center whitespace-nowrap flex-shrink-0`,
  cardPillDot: (color: "amber" | "green" | "blue") => {
    const colors = {
      amber: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.14)]",
      green: "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.14)]",
      blue: "bg-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.14)]",
    };
    return `w-1.5 h-1.5 rounded-full ${colors[color]}`;
  },
  cardBig: `text-[22px] font-extrabold tracking-wide leading-none text-zinc-100`,
  cardBigSmall: `text-[18px] font-extrabold tracking-wide leading-none text-zinc-100`,
  cardBigAmber: `text-amber-400`,
  cardMeta: `text-[10px] text-zinc-500 leading-snug line-clamp-2 overflow-hidden`,
  cardSmall: `text-[11px] text-zinc-400 leading-snug`,

  // Wide card (decisions) tile layout
  tileHead: `flex items-center justify-between gap-1.5`,
  tilePill: `inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border border-zinc-700/92 bg-zinc-800/58 text-zinc-400 text-[9px] whitespace-nowrap flex-shrink-0`,
  tilePrimary: `mt-1.5 text-[16px] font-extrabold tracking-tight leading-tight text-zinc-100`,
  tileMeta: `mt-0.5 text-[10px] text-zinc-400 leading-snug`,
  tileMetaHighlight: `text-amber-400 font-bold`,
  tileFooter: `mt-1.5 text-[9px] text-zinc-500 flex items-center gap-1.5 flex-wrap`,
  tileFooterLink: `text-blue-400 no-underline font-bold cursor-pointer hover:text-blue-300`,

  // Activity
  activityList: `flex flex-col gap-1 mt-0.5`,
  activityItem: `flex justify-between gap-1.5 items-center px-2 py-1.5 rounded-[8px] bg-zinc-900/50 cursor-pointer select-none text-left w-full`,
  activityText: `text-[10px] text-zinc-400 leading-snug flex-1`,
  activityTextStrong: `text-zinc-100 font-semibold`,
  activityTime: `text-zinc-500 text-[9px] whitespace-nowrap flex-shrink-0`,

  // Bottom tabs
  tabs: `sticky bottom-0 pb-[env(safe-area-inset-bottom)] flex gap-1.5 justify-between bg-gradient-to-t from-zinc-950/92 via-zinc-950/85 to-transparent pt-1.5 mt-0.5`,
  tab: (active: boolean) => `flex-1 min-h-[40px] rounded-[12px] border border-zinc-700/85 bg-zinc-800/55 flex justify-center items-center gap-1 text-zinc-400 text-[10px] select-none ${active ? "bg-blue-500/16 border-blue-500/35 text-zinc-100" : ""}`,

  // Page-level styles for section pages
  pageContainer: `max-w-[430px] mx-auto min-h-screen flex flex-col px-2 py-1.5`,
  pageHeader: `px-1 pt-0.5 pb-2 flex items-center gap-1.5`,
  pageBackButton: `text-zinc-400 hover:text-zinc-200 -ml-0.5 p-0.5 flex-shrink-0 transition-colors`,
  pageTitle: `text-[17px] leading-none font-bold tracking-wide text-zinc-100 flex-1`,
  pageContent: `flex-1 flex flex-col gap-1.5 px-0.5`,

  // Section card styles
  sectionCard: `bg-zinc-800/96 border border-zinc-700/95 rounded-[14px] p-3 shadow-lg`,
  sectionTitle: `text-[13px] font-bold text-zinc-100 mb-2`,
  sectionEmptyState: `text-center py-6 text-zinc-500 text-[12px]`,

  // List item styles
  listItem: `border border-zinc-700/80 rounded-[12px] p-2.5 hover:border-zinc-600/90 transition-colors cursor-pointer bg-zinc-900/30`,
  listItemTitle: `font-semibold text-zinc-100 text-[13px] leading-tight`,
  listItemMeta: `text-[11px] text-zinc-400 mt-0.5`,
  listItemBadge: (variant: "open" | "closed" | "pending" | "accepted" | "declined") => {
    const variants = {
      open: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
      closed: "bg-zinc-800 text-zinc-400 border-zinc-700",
      pending: "bg-amber-900/40 text-amber-400 border-amber-700/50",
      accepted: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
      declined: "bg-red-900/40 text-red-400 border-red-700/50",
    };
    return `px-1.5 py-0.5 text-[9px] font-medium rounded-full border ${variants[variant]}`;
  },

  // Button styles
  primaryButton: `px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[12px] transition-colors`,
  secondaryButton: `px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-[11px] border border-zinc-700 transition-colors`,

  // Summary card styles for section pages
  summaryCard: `p-2 rounded-[12px] border text-center`,
  summaryCardValue: `text-[15px] font-bold`,
  summaryCardLabel: `text-[9px] text-zinc-400`,

  // Filter button styles
  filterButton: (active: boolean) => `
    px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors
    ${active ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}
  `,

  // Tab switcher styles
  tabSwitcher: `flex gap-1.5 mb-2`,
  tabButton: (active: boolean) => `
    flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium transition-colors
    ${active ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}
  `,

  // Avatar styles for people page
  personAvatar: `w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0`,
  personAvatarImage: `w-8 h-8 rounded-full object-cover flex-shrink-0`,

  // Link button style
  linkButton: `w-full mt-2 py-2 text-center text-[11px] text-blue-400 font-medium`,
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
