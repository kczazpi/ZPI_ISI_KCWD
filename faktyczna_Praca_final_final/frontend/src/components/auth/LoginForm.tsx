/**
 * @module components/auth/LoginForm
 * @description Login form implementing the two-step E2EE authentication flow:
 *
 * Step 1: GET /api/v1/auth/kdf-params — retrieve user's Argon2id salt and params
 * Step 2: Derive K_derived → K_auth → auth_hash (Argon2id + HKDF, client-side)
 * Step 3: POST /api/v1/auth/login — send auth_hash to authenticate
 * Step 4: Store K_master (non-extractable CryptoKey) in memory
 *
 * Security note: The user's plaintext password NEVER leaves this component.
 * The password is consumed by Argon2id and immediately dropped from scope.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getKdfParams, login } from '@/api/auth'
import { deriveKeys } from '@/crypto/kdf'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ApiError } from '@/api/client'

type LoginStep = 'idle' | 'fetching-params' | 'deriving-keys' | 'authenticating' | 'success'

const STEP_LABELS: Record<LoginStep, string> = {
  idle: 'Zaloguj się',
  'fetching-params': 'Pobieranie parametrów...',
  'deriving-keys': 'Wyprowadzanie kluczy (Argon2id)...',
  authenticating: 'Uwierzytelnianie...',
  success: 'Sukces!',
}

export function LoginForm() {
  const { onAuthSuccess } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<LoginStep>('idle')
  const [error, setError] = useState<string | null>(null)

  const isLoading = step !== 'idle' && step !== 'success'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Podaj adres e-mail i hasło.')
      return
    }

    try {
      // Step 1: Fetch KDF parameters for this user
      setStep('fetching-params')
      const { kdf_salt, kdf_params } = await getKdfParams(email.trim().toLowerCase())

      // Step 2: Derive K_auth and K_master from password + salt
      // This is the expensive Argon2id step — may take 500ms–2s depending on hardware
      setStep('deriving-keys')
      const derivedKeys = await deriveKeys(password, kdf_salt, {
        m: kdf_params.m,
        t: kdf_params.t,
        p: kdf_params.p,
      })

      // Step 3: Authenticate with auth_hash — K_master stays in memory only
      setStep('authenticating')
      const response = await login({
        email: email.trim().toLowerCase(),
        auth_hash: derivedKeys.authHash,
      })

      // Step 4: Register successful auth — stores K_master, updates auth state
      setStep('success')
      onAuthSuccess(response.user, derivedKeys)

    } catch (err) {
      setStep('idle')
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Nieprawidłowy adres e-mail lub hasło.')
        } else if (err.status === 429) {
          setError('Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.')
        } else {
          setError(err.message)
        }
      } else if (err instanceof Error) {
        setError(`Błąd kryptograficzny: ${err.message}`)
      } else {
        setError('Nieznany błąd. Spróbuj ponownie.')
      }
    }
  }

  return (
    <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="auth-form__header">
        <div className="auth-form__lock-icon" aria-hidden="true">🔐</div>
        <h1 className="auth-form__title">Zaloguj się</h1>
        <p className="auth-form__subtitle">
          Klucze szyfrowania są wyprowadzane lokalnie z Twojego hasła.
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Adres e-mail
        </label>
        <input
          id="email"
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          disabled={isLoading}
          required
          aria-required="true"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Hasło główne
        </label>
        <input
          id="password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={isLoading}
          required
          aria-required="true"
        />
        <p className="form-hint">
          Hasło nigdy nie jest wysyłane do serwera — służy tylko do lokalnego wyprowadzenia kluczy.
        </p>
      </div>

      {isLoading && (
        <div className="auth-form__progress">
          <LoadingSpinner size="sm" label={STEP_LABELS[step]} />
          <span className="auth-form__progress-label">{STEP_LABELS[step]}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn btn--primary btn--full"
        disabled={isLoading}
      >
        {isLoading ? STEP_LABELS[step] : 'Zaloguj się'}
      </button>

      <div className="auth-form__footer">
        <p>
          Nie masz konta?{' '}
          <Link to="/register" className="auth-form__link">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </form>
  )
}
