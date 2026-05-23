"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { createSupabaseBrowserClient } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";

// Prevent Next.js from statically prerendering this page at build time.
// The login page is dynamic — it reads cookies and env vars at runtime.
export const dynamic = "force-dynamic";

type Theme = "dark" | "light" | "midnight" | "warm" | "koryo-red";

const THEMES: { id: Theme; label: string; btnClass: string }[] = [
  { id: "koryo-red", label: "Koryo Red", btnClass: styles.themeBtnKoryoRed ?? "" },
  { id: "dark",      label: "Dark",      btnClass: styles.themeBtnDark     ?? "" },
  { id: "light",     label: "Light",     btnClass: styles.themeBtnLight    ?? "" },
  { id: "midnight",  label: "Midnight",  btnClass: styles.themeBtnMidnight ?? "" },
  { id: "warm",      label: "Warm",      btnClass: styles.themeBtnWarm     ?? "" },
];

/* ── Icons ─────────────────────────────────────────────── */
const IconEmail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const IconEye = ({ off }: { off?: boolean }) => off ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconLogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12Z" />
    <path d="M12 18v-4M12 10V6M8 14l-2 2M6 10l2 2M16 14l2 2M18 10l-2 2" />
  </svg>
);
const IconGGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);
const IconApple = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.26.45 3.09.45.81 0 2.23-.58 3.84-.4 1.76.14 3.06.84 3.9 2.1-3.23 1.95-2.69 5.86.53 7.15-.65 1.6-1.53 3.03-3.36 3.67zm-3.6-14.7c-.16-2.18 1.83-4.08 4.05-4.14.33 2.3-2.07 4.27-4.05 4.14z" />
  </svg>
);

/* ── Feature data ────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-primary)" }}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "The Drift Detector",
    desc: "Predictive analytics tracking attendance velocity to catch churn before it happens.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-secondary)" }}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    ),
    title: "Vision Master AI",
    desc: "Gold-standard biomechanical matching for student technique evaluation.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--status-success)" }}>
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
      </svg>
    ),
    title: "Continuous Class Transcription",
    desc: "Hands-free mat-side logging generating automated post-class action boards.",
  },
];

/* ══════════════════════════════════════════════════════════
   LOGIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function LoginPage() {
  // Lazy Supabase client — only instantiated on first user action, never during SSR/prerender
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  };

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [theme, setThemeState]    = useState<Theme>("koryo-red");

  // On mount — read saved theme
  useEffect(() => {
    const saved = localStorage.getItem("koryograph-theme") as Theme | null;
    if (saved) applyTheme(saved);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("koryograph-theme", t);
    setThemeState(t);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("User data could not be retrieved.");
        setLoading(false);
        return;
      }

      // Fetch user role from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role_id")
        .eq("user_id", authData.user.id);

      if (rolesError) {
        setError("Failed to verify user roles: " + rolesError.message);
        setLoading(false);
        return;
      }

      if (!roles || roles.length === 0) {
        setError("This account does not have any assigned roles.");
        setLoading(false);
        return;
      }

      // Assign destination based on roles
      const roleIds = roles.map((r) => r.role_id);
      let redirectUrl = "";

      const DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
      const IS_PROD = process.env.NODE_ENV === "production";

      if (roleIds.includes("owner") || roleIds.includes("admin")) {
        redirectUrl = IS_PROD ? `https://desk.${DOMAIN}` : "http://localhost:3002";
      } else if (roleIds.includes("instructor")) {
        redirectUrl = IS_PROD ? `https://app.${DOMAIN}` : "http://localhost:3001";
      } else {
        redirectUrl = IS_PROD ? `https://home.${DOMAIN}` : "http://localhost:3003";
      }

      window.location.href = redirectUrl;

    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during sign-in.");
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError("");
    try {
      const supabase = getSupabase();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) setError(authError.message);
    } catch (err: any) {
      setError(err?.message || `Failed to initiate OAuth login via ${provider}.`);
    }
  };

  return (
    <div className={styles.page}>

      {/* ── LEFT PANEL ─────────────────────────────────── */}
      <aside className={styles.leftPanel}>
        <div className={styles.glowOrb1} aria-hidden />
        <div className={styles.glowOrb2} aria-hidden />

        {/* Logo */}
        <div className={styles.logoLockup}>
          <div className={styles.logoMark}><IconLogoMark /></div>
          <div className={styles.logoText}>
            KoryoGraph
          </div>
        </div>

        {/* Hero Copy */}
        <div className={styles.heroSection}>
          <div className={styles.heroTag}>
            <span className={styles.dot} />
            AI-Native · Multi-Tenant SaaS
          </div>
          <h1 className={styles.heroHeadline}>
            The <span>Virtual Staff Member</span> for Modern Dojangs.
          </h1>
          <p className={styles.heroSubheadline}>
            Leave legacy software behind. Orchestrate your classes, predict student churn, and automate your back-office with AI-native workflows built for martial arts studios.
          </p>

          <div className={styles.featureList}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureItem}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureText}>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className={styles.panelFooter}>
          &copy; {new Date().getFullYear()} SVL Systems. Secure, compliant, and powered by AI.
        </footer>
      </aside>

      {/* ── RIGHT PANEL ────────────────────────────────── */}
      <main className={styles.rightPanel}>

        {/* Mobile logo */}
        <div className={styles.mobileLogo}>
          <div className={styles.mobileLogoMark}><IconLogoMark /></div>
          <span className={styles.mobileLogoText}>KoryoGraph</span>
        </div>

        {/* Form card */}
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSubtitle}>
              Sign in to access your studio dashboard.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            {/* Error */}
            {error && (
              <div className={styles.errorMsg} role="alert">
                <IconAlert /> {error}
              </div>
            )}

            {/* Email */}
            <div className={styles.fieldGroup}>
              <label className="kg-label" htmlFor="email">Email Address</label>
              <div className="kg-input-group">
                <span className="kg-input-icon"><IconEmail /></span>
                <input
                  id="email"
                  type="email"
                  className="kg-input"
                  placeholder="instructor@dojang.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className={styles.fieldGroup}>
              <div className={styles.fieldHeader}>
                <label className="kg-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                <a href="/forgot-password" className={styles.forgotLink}>Forgot password?</a>
              </div>
              <div className="kg-input-group" style={{ position: "relative" }}>
                <span className="kg-input-icon"><IconLock /></span>
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className="kg-input"
                  style={{ paddingRight: "42px" }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "var(--text-muted)",
                    display: "flex", padding: 0,
                  }}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  <IconEye off={showPass} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className={`kg-btn-primary ${styles.submitBtn}`}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <><span className={styles.spinner} /> Signing in…</>
              ) : (
                <>Sign In <IconArrow /></>
              )}
            </button>
          </form>

          {/* OAuth */}
          <div className={styles.oauthDivider}>
            <div className="kg-divider">Or continue with</div>
          </div>
          <div className={styles.oauthGrid}>
            <button
              id="oauth-google"
              className={styles.oauthBtn}
              type="button"
              onClick={() => handleOAuth("google")}
            >
              <IconGGoogle /> Google
            </button>
            <button
              id="oauth-apple"
              className={styles.oauthBtn}
              type="button"
              onClick={() => handleOAuth("apple")}
            >
              <IconApple /> Apple
            </button>
          </div>
        </div>

        {/* Theme Switcher Pill */}
        <div className={styles.themeSwitcher} role="group" aria-label="Choose theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              id={`theme-${t.id}`}
              className={`${styles.themeBtn} ${t.btnClass} ${theme === t.id ? styles.active : ""}`}
              onClick={() => applyTheme(t.id)}
              title={t.label}
              aria-label={`${t.label} theme`}
              aria-pressed={theme === t.id}
            />
          ))}
        </div>

      </main>
    </div>
  );
}
