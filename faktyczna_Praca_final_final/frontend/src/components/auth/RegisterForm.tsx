/**
 * @module components/auth/RegisterForm
 * @description Registration form implementing the E2EE onboarding flow:
 *
 * Step 1: Generate a cryptographically random 128-bit user salt (client-side)
 * Step 2: Derive K_derived → K_auth → K_master from password + salt (Argon2id + HKDF)
 * Step 3: POST /api/v1/auth/register — send email, auth_hash, kdf_salt, kdf_params
 * Step 4: Store K_master in memory, mark user as authenticated
 *
 * Security note: The salt is generated client-side and sent to the server for storage.
 * The server cannot reconstruct K_master from the salt — it needs the user's password.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { register, login } from '@/api/auth'
import { generateUserSalt, deriveKeys, DEFAULT_ARGON2_PARAMS } from '@/crypto/kdf'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ApiError } from '@/api/client'

type RegisterStep =
  | 'idle'
  | 'generating-salt'
  | 'deriving-keys'
  | 'registering'
  | 'logging-in'
  | 'success'

const STEP_LABELS: Record<RegisterStep, string> = {
  idle: 'Zarejestruj się',
  'generating-salt': 'Generowanie soli...',
  'deriving-keys': 'Wyprowadzanie kluczy (Argon2id)...',
  registering: 'Tworzenie konta...',
  'logging-in': 'Logowanie...',
  success: 'Konto utworzone!',
}

/** Minimum password strength requirements. */
const MIN_PASSWORD_LENGTH = 12

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`
  }
  return null
}

export function RegisterForm() {
  const { onAuthSuccess } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [step, setStep] = useState<RegisterStep>('idle')
  const [error, setError] = useState<string | null>(null)

  const isLoading = step !== 'idle' && step !== 'success'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!email.trim()) {
      setError('Podaj adres e-mail.')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== passwordConfirm) {
      setError('Hasła nie są zgodne.')
      return
    }

    try {
      // Step 1: Generate a fresh random salt for this user
      setStep('generating-salt')
      const kdfSalt = generateUserSalt()

      // Step 2: Derive keys — Argon2id KDF (memory-hard, expensive on purpose)
      setStep('deriving-keys')
      const derivedKeys = await deriveKeys(password, kdfSalt, DEFAULT_ARGON2_PARAMS)

      // Step 3: Register the account — send auth_hash and salt (NOT the password or K_master)
      setStep('registering')
      await register({
        email: email.trim().toLowerCase(),
        auth_hash: derivedKeys.authHash,
        kdf_salt: kdfSalt,
        kdf_params: {
          algorithm: 'argon2id',
          ...DEFAULT_ARGON2_PARAMS,
        },
      })

      // Step 4: Log in automatically after registration
      setStep('logging-in')
      const loginResponse = await login({
        email: email.trim().toLowerCase(),
        auth_hash: derivedKeys.authHash,
      })

      setStep('success')
      onAuthSuccess(loginResponse.user, derivedKeys)

    } catch (err) {
      setStep('idle')
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Użytkownik o tym adresie e-mail już istnieje.')
        } else if (err.status === 429) {
          setError('Zbyt wiele prób rejestracji. Spróbuj ponownie za godzinę.')
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
        <div className="auth-form__lock-icon" aria-hidden="true">🔑</div>
        <h1 className="auth-form__title">Utwórz konto</h1>
        <p className="auth-form__subtitle">
          Klucz szyfrowania jest wyprowadzany lokalnie — serwer nigdy nie widzi Twoich notatek.
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
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          disabled={isLoading}
          required
          aria-required="true"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="form-hint">
          Minimum {MIN_PASSWORD_LENGTH} znaków. Hasło nigdy nie jest wysyłane do serwera —
          służy tylko do lokalnego wyprowadzenia kluczy szyfrowania (Argon2id + HKDF).
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="password-confirm" className="form-label">
          Potwierdź hasło
        </label>
        <input
          id="password-confirm"
          type="password"
          className="form-input"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={isLoading}
          required
          aria-required="true"
        />
      </div>

      <div className="auth-form__warning">
        ⚠️ <strong>Ważne:</strong> Jeśli zapomnisz hasła, nie będzie możliwe odzyskanie zaszyfrowanych notatek.
        Hasło jest jedynym kluczem do Twoich danych.
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
        {isLoading ? STEP_LABELS[step] : 'Utwórz konto'}
      </button>

      <div className="auth-form__footer">
        <p>
          Masz już konto?{' '}
          <Link to="/login" className="auth-form__link">
            Zaloguj się
          </Link>
        </p>
      </div>
    </form>
  )
}
