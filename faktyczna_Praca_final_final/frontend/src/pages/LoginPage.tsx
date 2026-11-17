/**
 * @module pages/LoginPage
 * @description Login page — full-page layout wrapping the LoginForm component.
 * Redirects to dashboard if the user is already authenticated.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function LoginPage() {
  const { user, isCryptoReady, isLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect to dashboard if already authenticated with key in memory
  useEffect(() => {
    if (!isLoading && user && isCryptoReady) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, isCryptoReady, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="full-page-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-page__card">
        <LoginForm />
      </div>
      <footer className="auth-page__footer">
        <p>Wszystkie notatki są szyfrowane AES-256-GCM lokalnie w Twojej przeglądarce.</p>
        <p>Serwer przechowuje wyłącznie szyfrogramy — Zero-Knowledge architecture.</p>
      </footer>
    </main>
  )
}
