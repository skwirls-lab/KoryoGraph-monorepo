"use client";
import styles from "./Sidebar.module.css";

/* ── Icons ─────────────────────────────────────────────── */
const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const LogoMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12Z" />
    <path d="M12 18v-4M12 10V6M8 14l-2 2M6 10l2 2M16 14l2 2M18 10l-2 2" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ── Nav data ───────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Command Center",
    items: [
      { id: "dashboard",  label: "Dashboard",       icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { id: "ai-assist",  label: "AI Assistant",    icon: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z", badge: "AI" },
      { id: "analytics",  label: "Analytics",       icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
    ],
  },
  {
    label: "Studio",
    items: [
      { id: "students",   label: "Students",        icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
      { id: "classes",    label: "Classes",         icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
      { id: "drift",      label: "Drift Detector",  icon: "M22 12h-4l-3 9L9 3l-3 9H2", badge: "3" },
      { id: "belt-log",   label: "Belt Logistics",  icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.5 12a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" },
    ],
  },
  {
    label: "Back Office",
    items: [
      { id: "crm",        label: "CRM / Leads",     icon: "M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34" },
      { id: "billing",    label: "Billing & POS",   icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { id: "after-school", label: "After School",  icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "staff",      label: "Staff & Roles",   icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
      { id: "settings",   label: "Settings",        icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    ],
  },
];

interface SidebarProps {
  activeItem?: string;
  onNavigate?: (id: string) => void;
  studioName?: string;
  userInitials?: string;
}

export default function Sidebar({
  activeItem = "dashboard",
  onNavigate,
  studioName = "Your Studio",
  userInitials = "KG",
}: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <div className={styles.logoMark}><LogoMark /></div>
        <div>
          <div className={styles.logoText}>KoryoGraph</div>
          <div className={styles.logoSub}>Desk</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.navSection}>
            <div className={styles.navSectionLabel}>{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`${styles.navItem} ${activeItem === item.id ? styles.active : ""}`}
                onClick={() => onNavigate?.(item.id)}
              >
                <span className={styles.navIcon}>
                  <Icon d={item.icon} />
                </span>
                {item.label}
                {item.badge && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Studio card */}
      <div className={styles.studioSelector}>
        <div className={styles.studioCard}>
          <div className={styles.studioAvatar}>{userInitials.slice(0, 2)}</div>
          <div className={styles.studioInfo}>
            <div className={styles.studioName}>{studioName}</div>
            <div className={styles.studioRole}>Owner · Admin</div>
          </div>
          <span className={styles.chevron}><ChevronIcon /></span>
        </div>
      </div>
    </aside>
  );
}
