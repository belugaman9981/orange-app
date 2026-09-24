export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <rect width="32" height="32" rx="5" fill="var(--orange-500)" />
            <circle cx="16" cy="16" r="8" fill="none" stroke="white" strokeWidth="2" />
            <path d="M16 8V4" stroke="white" strokeWidth="2" />
          </svg>
        </span>
        <div>
          <span className="app-header__name">Orange</span>
        </div>
      </div>
      <span className="app-header__context">Support tools <span>/</span> Ticket triage</span>
      <span className="app-header__privacy">Runs locally in your browser</span>
    </header>
  );
}
