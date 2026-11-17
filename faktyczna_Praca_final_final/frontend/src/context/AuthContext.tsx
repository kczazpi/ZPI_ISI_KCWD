/**
 * @module context/AuthContext
 * @description React context providing authentication state and E2EE key management.
 *
 * This context serves two purposes:
 * 1. Auth state: Tracks whether the user is logged in and their profile data.
 * 2. Key gate: Coordinates the lifecycle of K_master in the keys.ts module.
 *    Components that need to encrypt/decrypt notes should call getMasterKey()
 *    from the crypto/keys module directly (not through this context, to avoid
 *    accidentally serializing the CryptoKey through React state).
 *
 * K_master is NEVER stored in React state — it lives only in the keys.ts module.
 * This context only tracks whether a key is loaded (boolean flag), not the key itself.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser, logout as apiLogout } from '@/api/auth'
import { clearMasterKey, hasMasterKey, setMasterKey } from '@/crypto/keys'
import type { UserResponse } from '@/api/types'
import type { DerivedKeys } from '@/crypto/kdf'

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Currently authenticated user, or null if not logged in. */
  user: UserResponse | null

  /**
   * Whether K_master is loaded in memory.
   * True after a successful login/register that completes key derivation.
   * Becomes false on logout.
   *
   * Important: This is a boolean flag — the actual CryptoKey is in crypto/keys.ts.
   */
  isCryptoReady: boolean

  /** Whether the initial auth check (fetching /api/v1/auth/me) is in progress. */
  isLoading: boolean

  /**
   * Called after successful key derivation (login or register flow).
   * Stores K_master in the in-memory session and updates auth state.
   *
   * @param user        - Authenticated user profile from the server
   * @param derivedKeys - Keys from kdf.deriveKeys() — only masterKey is stored
   */
  onAuthSuccess: (user: UserResponse, derivedKeys: DerivedKeys) => void

  /**
   * Logs out the user: invalidates the server session, clears K_master from
   * memory, and resets auth state.
   */
  logout: () => Promise<void>
}

// ─── Context creation ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Wraps the application with authentication state and key lifecycle management.
 * On mount, it checks whether the user has an active session by calling /api/v1/auth/me.
 * If the session is valid but K_master is missing (e.g., after a page refresh),
 * the user is treated as unauthenticated (they must log in again to rederive K_master).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isCryptoReady, setIsCryptoReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * On mount: check for an existing server session.
   * If the session cookie is valid but K_master is not in memory (page refresh),
   * we cannot decrypt notes — user must re-enter their password to rederive K_master.
   * This is the fundamental security trade-off of E2EE: no server can "restore" the key.
   */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await getCurrentUser()
        // Server session is valid — but K_master is not in memory after page refresh.
        // Set user data for display, but isCryptoReady stays false until re-login.
        if (hasMasterKey()) {
          setUser(currentUser)
          setIsCryptoReady(true)
        } else {
          // Session exists but no key in memory — user needs to log in again
          // to rederive K_master. Clear the user state so ProtectedRoute redirects.
          setUser(null)
          setIsCryptoReady(false)
        }
      } catch {
        // 401 or network error — no active session
        setUser(null)
        setIsCryptoReady(false)
      } finally {
        setIsLoading(false)
      }
    }

    void checkSession()
  }, [])

  /**
   * Called by login and register flows after successful key derivation.
   * Stores K_master in-memory and updates auth state.
   */
  const onAuthSuccess = useCallback((userData: UserResponse, derivedKeys: DerivedKeys) => {
    setMasterKey(derivedKeys.masterKey)
    setUser(userData)
    setIsCryptoReady(true)
  }, [])

  /**
   * Logs out the user:
   * 1. Calls the backend to invalidate the server-side session.
   * 2. Clears K_master from in-memory session storage.
   * 3. Resets React auth state.
   * 4. Navigates to the login page.
   */
  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // Even if the API call fails, we still clear the local state
      // to prevent the user from being stuck in an authenticated-looking UI.
    } finally {
      clearMasterKey()
      setUser(null)
      setIsCryptoReady(false)
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const value: AuthContextValue = {
    user,
    isCryptoReady,
    isLoading,
    onAuthSuccess,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook to access the authentication context.
 * Must be used within an <AuthProvider> tree.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
