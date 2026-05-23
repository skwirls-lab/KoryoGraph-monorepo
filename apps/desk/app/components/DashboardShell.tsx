"use client";

import { useState, useEffect } from "react";
import styles from "./DashboardShell.module.css";
import { createSupabaseBrowserClient } from "@repo/database";
import type { User } from "@supabase/supabase-js";

/* ── Icons ─────────────────────────────────────────────── */
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DollarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

/* ── Mock Data ────────────────────────────────────────── */
const DRIFT_ALERTS = [
  { name: "Leo Henderson", class: "Taekwondo Teens", lastSeen: "12 days ago", velocity: "-60%", statusClass: styles.driftHigh, statusLabel: "High Risk" },
  { name: "Maya Sterling", class: "Little Tigers (4-6)", lastSeen: "9 days ago", velocity: "-40%", statusClass: styles.driftMed, statusLabel: "Medium Risk" },
  { name: "Devon Brooks", class: "Adult Hapkido", lastSeen: "8 days ago", velocity: "-35%", statusClass: styles.driftMed, statusLabel: "Medium Risk" },
];

const RECENT_ACTIVITY = [
  { text: "<strong>Grandmaster Kang</strong> evaluated biomechanical form check for <strong>Ethan Vance</strong>", time: "10 mins ago", color: "var(--accent-primary)" },
  { text: "Lead registered: <strong>Sarah Chen</strong> (Adult Program trial class request)", time: "34 mins ago", color: "var(--accent-secondary)" },
  { text: "Automated billing processed: <strong>24 recurring monthly tuitions</strong> completed", time: "1 hour ago", color: "var(--status-success)" },
  { text: "Attendance alert: <strong>3 students marked at-risk</strong> by Drift Detector engine", time: "2 hours ago", color: "var(--status-danger)" },
];

interface DashboardShellProps {
  activeView: string;
}

export default function DashboardShell({ activeView }: DashboardShellProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([
    "Hello! I am your KoryoGraph Staff AI. I've audited the class attendance logs and biomechanical technique uploads. Grandmaster Kang's afternoon class had a 92% performance match. Would you like me to draft progress notifications for parents?",
  ]);

  // Auth checking
  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session) {
            setUser(session.user);
          } else {
            // Fallback for visual preview if not logged in (to prevent blocking during design session)
            setUser({
              id: "placeholder-id",
              email: "master.kang@koryograph.ai",
              user_metadata: { first_name: "Grandmaster", last_name: "Kang" },
              created_at: "",
              app_metadata: {},
              aud: "authenticated",
              role: "authenticated",
            } as any);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (mounted) {
          setLoading(false);
        }
      }
    }
    checkAuth();
    return () => { mounted = false; };
  }, []);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, chatInput]);
    const userMsg = chatInput.trim();
    setChatInput("");

    // Simple auto-reply mock
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        `I received: "${userMsg}". I am scanning studio logs to complete your request. Supabase data integrations are active.`,
      ]);
    }, 1000);
  };

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    const IS_PROD = process.env.NODE_ENV === "production";
    const DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
    window.location.href = IS_PROD ? `https://login.${DOMAIN}` : "http://localhost:3000";
  };

  if (loading) {
    return (
      <div className={styles.authOverlay}>
        <div className={styles.authSpinner} />
        <span className={styles.authMsg}>Securing command panel...</span>
      </div>
    );
  }

  const welcomeName = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "Master";

  return (
    <div className={styles.deskMain}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <div className={styles.pageTitle}>
          {activeView.toUpperCase()} / command_center
        </div>
        <div className={styles.topbarRight}>
          <button className={styles.topbarBtn} title="Search logs">
            <SearchIcon />
          </button>
          <button className={styles.topbarBtn} title="Notifications">
            <BellIcon />
            <span className={styles.topbarBtnDot} />
          </button>
          <button 
            className={styles.avatarBtn} 
            title={`Logged in as ${user?.email}. Click to sign out.`}
            onClick={handleLogout}
          >
            {welcomeName[0]}
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className={styles.content}>
        {/* Welcome Header */}
        <div className={styles.welcomeHeader}>
          <div className={styles.welcomeEyebrow}>KoryoGraph System Ready</div>
          <h2 className={styles.welcomeTitle}>Welcome back, {welcomeName}</h2>
          <p className={styles.welcomeSub}>
            Here is what's happening at your studio today. Biomechanical evaluations are processed.
          </p>
        </div>

        {/* KPI Stats */}
        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statLabel}>Active Students</span>
              <div className={styles.statIconWrap} style={{ background: "rgba(99,102,241,0.12)", color: "var(--accent-primary)" }}>
                <UsersIcon />
              </div>
            </div>
            <div className={styles.statValue}>248</div>
            <div className={`${styles.statDelta} ${styles.statDeltaUp}`}>
              <ArrowUpIcon /> +12% this month
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statLabel}>Monthly Revenue</span>
              <div className={styles.statIconWrap} style={{ background: "rgba(16,185,129,0.12)", color: "var(--status-success)" }}>
                <DollarIcon />
              </div>
            </div>
            <div className={styles.statValue}>$18,450</div>
            <div className={`${styles.statDelta} ${styles.statDeltaUp}`}>
              <ArrowUpIcon /> +4.2% since last month
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statLabel}>Churn Prediction</span>
              <div className={styles.statIconWrap} style={{ background: "rgba(239,68,68,0.12)", color: "var(--status-danger)" }}>
                <ActivityIcon />
              </div>
            </div>
            <div className={styles.statValue}>1.8%</div>
            <div className={`${styles.statDelta} ${styles.statDeltaDown}`}>
              <ArrowDownIcon /> -0.5% lower risk
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statLabel}>Lead Conversion</span>
              <div className={styles.statIconWrap} style={{ background: "rgba(59,130,246,0.12)", color: "var(--status-info)" }}>
                <SparklesIcon />
              </div>
            </div>
            <div className={styles.statValue}>68%</div>
            <div className={`${styles.statDelta} ${styles.statDeltaUp}`}>
              <ArrowUpIcon /> +8% trial booking rate
            </div>
          </div>
        </div>

        {/* Panel Grid */}
        <div className={styles.panelGrid}>
          {/* Main activity feed panel */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Mat-Side Activity & Biomechanical Uploads</h3>
              <button className={styles.panelAction}>View all logs</button>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.activityList}>
                {RECENT_ACTIVITY.map((act, index) => (
                  <div key={index} className={styles.activityItem}>
                    <span className={styles.activityDot} style={{ backgroundColor: act.color }} />
                    <div className={styles.activityText} dangerouslySetInnerHTML={{ __html: act.text }} />
                    <span className={styles.activityTime}>{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Sidebar panel (Drift Detector + AI Assistant) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Drift Detector Widget */}
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Drift Detector Alerts</h3>
                <span className={styles.panelAction}>Resolve</span>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.driftList}>
                  {DRIFT_ALERTS.map((alert) => (
                    <div key={alert.name} className={styles.driftItem}>
                      <div className={styles.driftAvatar}>
                        {alert.name[0]}
                      </div>
                      <div className={styles.driftInfo}>
                        <div className={styles.driftName}>{alert.name}</div>
                        <div className={styles.driftDetail}>
                          {alert.class} • {alert.lastSeen}
                        </div>
                      </div>
                      <span className={`${styles.driftRisk} ${alert.statusClass}`}>
                        {alert.statusLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* AI Assistant Widget */}
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>KoryoGraph Staff AI</h3>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.aiPanel}>
                  <div style={{ maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={styles.aiChatBubble} style={{ background: i % 2 === 1 ? "var(--bg-elevated)" : "var(--accent-primary-subtle)", border: i % 2 === 1 ? "1px solid var(--border-default)" : "1px solid rgba(225,29,72,0.15)" }}>
                        {msg}
                      </div>
                    ))}
                  </div>
                  <form className={styles.aiChatInput} onSubmit={handleSendChat}>
                    <input
                      type="text"
                      className={styles.aiInput}
                      placeholder="Ask Staff AI to draft parent updates..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className={styles.aiSendBtn}>
                      <SendIcon />
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
