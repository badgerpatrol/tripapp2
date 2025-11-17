"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AdminModeContextType {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(
  undefined
);

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Load admin mode preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("adminMode");
    if (saved === "true") {
      setIsAdminMode(true);
    }
  }, []);

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("adminMode", String(newValue));
      return newValue;
    });
  };

  return (
    <AdminModeContext.Provider value={{ isAdminMode, toggleAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error("useAdminMode must be used within an AdminModeProvider");
  }
  return context;
}
