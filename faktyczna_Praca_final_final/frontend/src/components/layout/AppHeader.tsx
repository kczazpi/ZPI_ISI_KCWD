/**
 * @module components/layout/AppHeader
 * @description Top navigation bar for the authenticated dashboard.
 */

import { useAuth } from '@/context/AuthContext'

export function AppHeader() {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <svg
          className="app-header__logo"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="6" fill="#6366f1" />
          <path
            d="M12 4C9.515 4 7.5 6.015 7.5 8.5v1.5H6v9h12v-9h-1.5V8.5C16.5 6.015 14.485 4 12 4zm0 1.5a3 3 0 013 3V10H9V8.5a3 3 0 013-3zm0 6a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"
            fill="white"
          />
        </svg>
        <span className="app-header__title">E2EE Notes</span>
        <span className="app-header__badge">Zero-Knowledge</span>
      </div>

      <nav className="app-header__nav">
        {user && (
          <span className="app-header__user" title={user.email}>
            {user.email}
          </span>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => void handleLogout()}
        >
          Wyloguj
        </button>
      </nav>
    </header>
  )
}
