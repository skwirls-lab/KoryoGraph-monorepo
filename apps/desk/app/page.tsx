"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import DashboardShell from "./components/DashboardShell";

export default function DeskDashboardPage() {
  const [activeView, setActiveView] = useState("dashboard");

  return (
    <div className="desk-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeItem={activeView}
        onNavigate={(id) => setActiveView(id)}
        studioName="Koryo Martial Arts"
        userInitials="KM"
      />

      {/* Main dashboard view */}
      <DashboardShell activeView={activeView} />
    </div>
  );
}
