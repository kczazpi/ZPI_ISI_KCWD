/**
 * @module components/layout/ProtectedRoute
 * @description Route guard that ensures only authenticated users with K_master can access protected pages.
 *
 * Redirects to /login if:
 * - The initial session check is still loading (shows a spinner)
 * - The user is not authenticated (no active session)
 * - K_master is not in memory (page refresh without re-login)
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { ReactNode } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isCryptoReady, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="full-page-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Both conditions must be true: authenticated server session AND K_master in memory
  if (!user || !isCryptoReady) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
