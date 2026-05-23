"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { createSupabaseBrowserClient } from "@repo/database";
import type { User } from "@supabase/supabase-js";

/* ── Icons ─────────────────────────────────────────────── */
const LogoMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12Z" />
    <path d="M12 18v-4M12 10V6M8 14l-2 2M6 10l2 2M16 14l2 2M18 10l-2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Mock Data ────────────────────────────────────────── */
const MOCK_CHILDREN = [
  { id: "c1", name: "Maya Sterling", rank: "Red Belt", color: "#ef4444" },
  { id: "c2", name: "Ethan Vance", rank: "Black Belt (1st Dan)", color: "#09090b" },
];

const MOCK_MILESTONES: Record<string, { title: string; desc: string; done: boolean }[]> = {
  c1: [
    { title: "Attendance target reached", desc: "Completed 12 classes this training cycle.", done: true },
    { title: "Ap Chagi Evaluated", desc: "Biomechanical score: 94% precision achieved.", done: true },
    { title: "Taegeuk Yuk Jang Form", desc: "Instructor sign-off pending form review.", done: false },
    { title: "Sparring sparring criteria met", desc: "Participated in required sparring rounds.", done: false },
  ],
  c2: [
    { title: "Koryo Form Mastered", desc: "Grandmaster sign-off on form correctness.", done: true },
    { title: "Biomechanical precision match", desc: "Roundhouse kick skeletal extension hits 96% match.", done: true },
    { title: "Assistant coaching hours", desc: "Completed 5 hours of junior class support.", done: true },
    { title: "Promotion Board readiness", desc: "Scheduled for next Black Belt Promotion Board.", done: false },
  ],
};

const MOCK_STATS: Record<string, { classesDone: number; target: number; testDate: string; outstandingFee: number }> = {
  c1: { classesDone: 12, target: 20, testDate: "June 14, 2026", outstandingFee: 0 },
  c2: { classesDone: 28, target: 30, testDate: "July 08, 2026", outstandingFee: 150 },
};

export default function FamilyCompanionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeChild, setActiveChild] = useState("c1");

  // Check auth on mount
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
            // Visual Preview Fallback
            setUser({
              id: "placeholder-id",
              email: "parent.sterling@koryograph.ai",
              user_metadata: { first_name: "Sarah", last_name: "Sterling" },
              created_at: "",
              app_metadata: {},
              aud: "authenticated",
              role: "authenticated",
            } as any);
          }
          setAuthLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (mounted) setAuthLoading(false);
      }
    }
    checkAuth();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    const IS_PROD = process.env.NODE_ENV === "production";
    const DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
    window.location.href = IS_PROD ? `https://login.${DOMAIN}` : "http://localhost:3000";
  };

  if (authLoading) {
    return (
      <div className={styles.authOverlay}>
        <div className={styles.spinner} />
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "12px" }}>
          Loading companion portal...
        </span>
      </div>
    );
  }

  const childInfo = MOCK_CHILDREN.find((c) => c.id === activeChild) || { id: "c1", name: "Maya Sterling", rank: "Red Belt", color: "#ef4444" };
  const milestones = MOCK_MILESTONES[activeChild] || [];
  const stats = MOCK_STATS[activeChild] || { classesDone: 0, target: 20, testDate: "TBD", outstandingFee: 0 };
  const percentComplete = Math.min(100, Math.round((stats.classesDone / stats.target) * 100));

  return (
    <div className="home-container">
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}><LogoMark /></div>
          <div>
            <div className={styles.logoText}>KoryoGraph</div>
            <div className={styles.logoTag}>Companion</div>
          </div>
        </div>

        <div className={styles.userControl}>
          {/* Family student toggle */}
          <div className={styles.familySelector} role="group" aria-label="Select student">
            {MOCK_CHILDREN.map((child) => (
              <button
                key={child.id}
                onClick={() => setActiveChild(child.id)}
                className={`${styles.familyPill} ${activeChild === child.id ? styles.familyPillActive : ""}`}
              >
                {child.name.split(" ")[0]}
              </button>
            ))}
          </div>

          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className={styles.grid}>
        {/* Left Column: Progress overview & Milestones */}
        <div>
          {/* Belt Goal Card */}
          <div className={styles.beltHero}>
            <div
              className={styles.beltCircle}
              style={{ backgroundColor: childInfo.color, border: childInfo.color === "#f1f5f9" ? "1px solid var(--border-strong)" : "none" }}
            >
              🥋
            </div>
            <div className={styles.beltHeroContent}>
              <div className={styles.beltRank}>{childInfo.name}</div>
              <div className={styles.beltGoal}>Current Rank: {childInfo.rank}</div>
              {/* Progress Bar */}
              <div className={styles.progressContainer}>
                <div className={styles.progressLabel}>
                  <span>Attendance Cycle Progress</span>
                  <span>{stats.classesDone}/{stats.target} Classes</span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div className={styles.progressBarFill} style={{ width: `${percentComplete}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Promotion Board Requirements list */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Promotion Requirements Check-off</h2>
            <div className={styles.milestoneList}>
              {milestones.map((ms, index) => (
                <div key={index} className={styles.milestoneItem}>
                  <div className={`${styles.milestoneIcon} ${ms.done ? styles.milestoneCompleted : ""}`}>
                    {ms.done ? <CheckIcon /> : index + 1}
                  </div>
                  <div className={styles.milestoneInfo}>
                    <div className={styles.milestoneTitle}>{ms.title}</div>
                    <div className={styles.milestoneDesc}>{ms.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: AI biomech feedback and Tuition Payments */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Biomechanical skill extension video evaluator preview */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Biomechanical Kick Matcher</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "-12px", marginBottom: "16px" }}>
              Visual feed evaluating kick execution skeletal vectors.
            </p>

            <div className={styles.skeletonBox}>
              <svg width="120" height="150" viewBox="0 0 100 120" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round">
                {/* Stick figure representing skeletal nodes */}
                <circle cx="50" cy="20" r="8" fill="var(--bg-elevated)" stroke="var(--accent-secondary)" />
                <line x1="50" y1="28" x2="50" y2="70" />
                <line x1="50" y1="40" x2="25" y2="30" />
                <line x1="50" y1="40" x2="75" y2="45" />
                <line x1="50" y1="70" x2="25" y2="105" />
                <line x1="50" y1="70" x2="90" y2="80" /> {/* Kicking foot vector */}
              </svg>
              <div className={styles.skeletonOverlay}>Skeletal Vector Overlay Active</div>
            </div>
          </section>

          {/* Membership Tuition payment card */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Billing & Dues</h2>
            <div className={styles.billingBlock}>
              <div className={styles.billRow}>
                <span className={styles.billText}>Monthly Tuition Membership</span>
                <span className={styles.billAmount}>$150.00</span>
              </div>
              <div className={styles.billRow}>
                <span className={styles.billText}>Dues Status</span>
                <span className={stats.outstandingFee === 0 ? styles.billStatus : ""} style={{ color: stats.outstandingFee > 0 ? "var(--status-danger)" : "var(--status-success)" }}>
                  {stats.outstandingFee === 0 ? "PAID" : `$${stats.outstandingFee} OVERDUE`}
                </span>
              </div>

              {stats.outstandingFee > 0 && (
                <button className={styles.payButton}>
                  Pay Dues Now ($150)
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
