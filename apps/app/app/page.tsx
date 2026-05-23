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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Mock Data ────────────────────────────────────────── */
const MOCK_CLASSES = [
  { id: "c1", time: "4:00 PM", name: "Little Tigers (Ages 4-6)", count: "12 registered" },
  { id: "c2", time: "5:00 PM", name: "Taekwondo Teens", count: "18 registered" },
  { id: "c3", time: "6:15 PM", name: "Adult Hapkido & Sparring", count: "9 registered" },
];

const MOCK_ROSTERS: Record<string, { id: string; name: string; rank: string; beltColor: string; present: boolean }[]> = {
  c1: [
    { id: "s1", name: "Mason Cooper", rank: "White Belt", beltColor: "#f1f5f9", present: true },
    { id: "s2", name: "Lily Jenkins", rank: "Yellow Belt", beltColor: "#fbbf24", present: true },
    { id: "s3", name: "Owen Miller", rank: "Yellow Belt", beltColor: "#fbbf24", present: false },
    { id: "s4", name: "Chloe Bennett", rank: "Green Belt", beltColor: "#10b981", present: true },
  ],
  c2: [
    { id: "s5", name: "Leo Henderson", rank: "Blue Belt", beltColor: "#3b82f6", present: false },
    { id: "s6", name: "Maya Sterling", rank: "Red Belt", beltColor: "#ef4444", present: true },
    { id: "s7", name: "Ethan Vance", rank: "Black Belt (1st Dan)", beltColor: "#09090b", present: true },
    { id: "s8", name: "Sophia Reynolds", rank: "Red Belt", beltColor: "#ef4444", present: true },
  ],
  c3: [
    { id: "s9", name: "Devon Brooks", rank: "Brown Belt", beltColor: "#78350f", present: true },
    { id: "s10", name: "Marcus Torres", rank: "Black Belt (3rd Dan)", beltColor: "#09090b", present: false },
    { id: "s11", name: "Sarah Chen", rank: "White Belt", beltColor: "#f1f5f9", present: true },
  ],
};

const MOCK_TECHNIQUES = [
  { id: "t1", name: "Roundhouse Kick (Dollyo Chagi)", score: 94 },
  { id: "t2", name: "Back Kick (Dwi Chagi)", score: 87 },
  { id: "t3", name: "Front Kick (Ap Chagi)", score: 96 },
  { id: "t4", name: "Axe Kick (Naeryeo Chagi)", score: 81 },
];

export default function MatSideInstructorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("c2");
  const [roster, setRoster] = useState(MOCK_ROSTERS);
  const [selectedTechnique, setSelectedTechnique] = useState("t1");

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
              email: "instructor.vance@koryograph.ai",
              user_metadata: { first_name: "Instructor", last_name: "Vance" },
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

  const handleToggleAttendance = (studentId: string) => {
    setRoster((prev) => {
      const currentList = prev[selectedClass] || [];
      const updatedList = currentList.map((student) =>
        student.id === studentId ? { ...student, present: !student.present } : student
      );
      return {
        ...prev,
        [selectedClass]: updatedList,
      };
    });
  };

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
          Initializing mat-side dashboard...
        </span>
      </div>
    );
  }

  const currentClassRoster = roster[selectedClass] || [];
  const activeTechnique = MOCK_TECHNIQUES.find((t) => t.id === selectedTechnique) || { id: "t1", name: "Roundhouse Kick (Dollyo Chagi)", score: 94 };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoMark}><LogoMark /></div>
          <div>
            <div className={styles.logoText}>KoryoGraph</div>
            <div className={styles.logoTag}>Mat-Side</div>
          </div>
        </div>

        <div className={styles.userInfo}>
          <div className={styles.userMeta}>
            <div className={styles.userName}>
              {user?.user_metadata?.first_name || "Instructor"} {user?.user_metadata?.last_name || "Vance"}
            </div>
            <div className={styles.userRole}>Mat Leader</div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className={styles.grid}>
        {/* Left Column: Class Selector */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Class Schedule</h2>
          <div className={styles.classList}>
            {MOCK_CLASSES.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`${styles.classItem} ${selectedClass === cls.id ? styles.classItemActive : ""}`}
              >
                <div className={styles.classTime}>{cls.time}</div>
                <div className={styles.className}>{cls.name}</div>
                <div className={styles.classCount}>{cls.count}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Right Column: Attendance & Technique evaluation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Touch-based Student attendance */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Class Check-In
              <span style={{ fontSize: "0.8rem", color: "var(--accent-primary)" }}>
                {currentClassRoster.filter((s) => s.present).length} Present
              </span>
            </h2>

            <div className={styles.rosterList}>
              {currentClassRoster.map((student) => (
                <div
                  key={student.id}
                  className={`${styles.rosterItem} ${student.present ? styles.rosterItemChecked : ""}`}
                >
                  <div className={styles.rosterLeft}>
                    <span
                      className={styles.beltIndicator}
                      style={{ backgroundColor: student.beltColor, border: student.beltColor === "#f1f5f9" ? "1px solid var(--border-strong)" : "none" }}
                    />
                    <div>
                      <div className={styles.studentName}>{student.name}</div>
                      <div className={styles.studentRank}>{student.rank}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAttendance(student.id)}
                    className={`${styles.checkButton} ${student.present ? styles.checkButtonChecked : ""}`}
                    aria-label={`Toggle attendance for ${student.name}`}
                  >
                    <CheckIcon />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Biomechanical skill checking dashboard */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Biomechanical Vision Evaluator</h2>
            <p style={{ fontSize: "0.8rem", color: "--text-secondary", marginTop: "-12px", marginBottom: "16px" }}>
              Select a kick to view simulated skeletal node alignment and balance scores.
            </p>

            <div className={styles.skillSelector}>
              {MOCK_TECHNIQUES.map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => setSelectedTechnique(tech.id)}
                  className={`${styles.skillCard} ${selectedTechnique === tech.id ? styles.skillCardActive : ""}`}
                >
                  <div className={styles.skillName}>{tech.name}</div>
                  <div className={styles.skillMatch}>{tech.score}% form match</div>
                </button>
              ))}
            </div>

            {/* Skeletal node graph simulator */}
            <div className={styles.biomechPanel}>
              <h3 style={{ fontSize: "0.825rem", fontWeight: "700", color: "var(--text-primary)" }}>
                Active Evaluation: {activeTechnique.name} ({activeTechnique.score}% Precision)
              </h3>
              <div className={styles.visualGraph}>
                <div className={styles.bar} style={{ height: `${activeTechnique.score}%` }}>
                  {activeTechnique.score}%
                  <span className={styles.barLabel}>Balance</span>
                </div>
                <div className={styles.bar} style={{ height: `${activeTechnique.score - 5}%` }}>
                  {activeTechnique.score - 5}%
                  <span className={styles.barLabel}>Extension</span>
                </div>
                <div className={styles.bar} style={{ height: `${activeTechnique.score + 2}%` }}>
                  {Math.min(100, activeTechnique.score + 2)}%
                  <span className={styles.barLabel}>Rotation</span>
                </div>
                <div className={styles.bar} style={{ height: `${activeTechnique.score - 12}%` }}>
                  {activeTechnique.score - 12}%
                  <span className={styles.barLabel}>Recoil</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
