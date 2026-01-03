"use client";

import { useRouter } from "next/navigation";
import { styles } from "./TripHomeStyles";

interface BottomTabsProps {
  tripId: string;
  activeTab?: "home" | "spend" | "assign" | "check" | "settle";
}

const tabs = [
  { id: "home", label: "Home", icon: "🏠", path: (id: string) => `/trips/${id}/home` },
  { id: "spend", label: "Spend", icon: "💸", path: (id: string) => `/trips/${id}?tab=spends` },
  { id: "assign", label: "Assign", icon: "🧾", path: (id: string) => `/trips/${id}?tab=spends&filter=unassigned` },
  { id: "check", label: "Check", icon: "✓", path: (id: string) => `/trips/${id}?tab=checklists` },
  { id: "settle", label: "Settle", icon: "🤝", path: (id: string) => `/trips/${id}?tab=settle` },
] as const;

export function BottomTabs({ tripId, activeTab = "home" }: BottomTabsProps) {
  const router = useRouter();

  return (
    <nav className={styles.tabs} aria-label="Bottom navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={styles.tab(activeTab === tab.id)}
          onClick={() => router.push(tab.path(tripId))}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </nav>
  );
}
