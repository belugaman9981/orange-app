import { useTheme } from "../hooks/useTheme";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <rect width="32" height="32" rx="5" fill="var(--orange-500)" />
            <circle cx="16" cy="16" r="8" fill="none" stroke="white" strokeWidth="2" />
            <path d="M16 8V4" stroke="white" strokeWidth="2" />
            <path className="app-header__leaf" d="M20.5 7.2c2.8-.2 4.4-1.3 5.2-3.2-2.6-.2-4.8.4-6.2 2.1-.5.6-.6 1-.7 1.6.6-.2 1.1-.4 1.7-.5Z" fill="white" />
          </svg>
        </span>
        <div>
          <span className="app-header__name">Orange</span>
        </div>
      </div>
      <span className="app-header__context">Questions & support</span>
      <div className="app-header__actions">
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {theme === "dark" ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </>
            ) : (
              <path d="M20.6 13.4A8.7 8.7 0 0 1 10.6 3.4a8.8 8.8 0 1 0 10 10Z" />
            )}
          </svg>
          <span>{nextTheme === "dark" ? "Dark mode" : "Light mode"}</span>
        </button>
      </div>
    </header>
  );
}
