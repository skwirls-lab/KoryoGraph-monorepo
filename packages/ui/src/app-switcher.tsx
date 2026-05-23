"use client";

import { useState } from "react";
import styles from "./app-switcher.module.css";

export type KoryoApp = "app" | "desk" | "home";

interface AppSwitcherProps {
  currentApp: KoryoApp;
  /** Which apps this user is allowed to access */
  allowedApps: KoryoApp[];
  /** Base URLs for each app — override for prod, defaults to localhost ports */
  appUrls?: Record<KoryoApp, string>;
}

const APP_META: Record<
  KoryoApp,
  { label: string; sublabel: string; icon: React.ReactNode; color: string }
> = {
  app: {
    label: "KoryoGraph",
    sublabel: "Mat-Side Engine",
    color: "var(--accent-primary)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  desk: {
    label: "KoryoGraph | Desk",
    sublabel: "Back-Office Admin",
    color: "var(--accent-secondary)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  home: {
    label: "KoryoGraph | Home",
    sublabel: "Member Companion",
    color: "var(--status-success)",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
};

const DEFAULT_URLS: Record<KoryoApp, string> = {
  app:  "http://localhost:3001",
  desk: "http://localhost:3002",
  home: "http://localhost:3003",
};

export function AppSwitcher({ currentApp, allowedApps, appUrls }: AppSwitcherProps) {
  const [open, setOpen] = useState(false);
  const urls = { ...DEFAULT_URLS, ...appUrls };
  const current = APP_META[currentApp];

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Switch application"
      >
        <span className={styles.triggerIcon} style={{ color: current.color }}>
          {current.icon}
        </span>
        <span className={styles.triggerLabel}>{current.label}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <p className={styles.dropdownHeader}>Switch Module</p>
            {(Object.keys(APP_META) as KoryoApp[]).map((appId) => {
              const meta = APP_META[appId];
              const allowed = allowedApps.includes(appId);
              const isCurrent = appId === currentApp;
              return (
                <a
                  key={appId}
                  href={allowed && !isCurrent ? urls[appId] : undefined}
                  className={`${styles.dropdownItem} ${isCurrent ? styles.dropdownItemActive : ""} ${!allowed ? styles.dropdownItemDisabled : ""}`}
                  onClick={() => setOpen(false)}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-disabled={!allowed}
                >
                  <span className={styles.dropdownIcon} style={{ color: meta.color }}>
                    {meta.icon}
                  </span>
                  <span className={styles.dropdownMeta}>
                    <span className={styles.dropdownLabel}>{meta.label}</span>
                    <span className={styles.dropdownSublabel}>{meta.sublabel}</span>
                  </span>
                  {isCurrent && (
                    <span className={styles.currentBadge}>Current</span>
                  )}
                  {!allowed && !isCurrent && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.lockIcon}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
