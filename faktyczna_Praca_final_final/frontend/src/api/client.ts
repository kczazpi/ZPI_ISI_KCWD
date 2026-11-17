/**
 * @module api/client
 * @description Axios-based HTTP client for the E2EE Notes backend API.
 *
 * Security considerations:
 * - `withCredentials: true` ensures session cookies (HttpOnly, SameSite=Lax) are
 *   sent with every request. The browser handles cookie storage — JS cannot read them.
 * - No auth tokens are stored in localStorage or memory — the backend session cookie
 *   handles authentication transparently.
 * - API base URL is configured for the Docker Compose network or local dev proxy.
 * - All 4xx/5xx responses are normalized to ApiError instances for consistent handling.
 */

import axios, { type AxiosError, type AxiosResponse } from 'axios'
import type { ApiErrorResponse } from './types'

/**
 * Structured error thrown for all non-2xx API responses.
 * Wraps the backend error response schema for type-safe error handling.
 */
export class ApiError extends Error {
  public readonly status: number
  public readonly detail: string

  constructor(message: string, status: number, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail ?? message
  }
}

/**
 * Axios instance configured for the E2EE Notes API.
 *
 * Base URL: In Docker Compose, the Vite dev server proxies /api to backend:8000.
 * In production, this should be set to the backend's public URL via VITE_API_URL env.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true, // Send HttpOnly session cookies on every request
  headers: {
    'Content-Type': 'application/json',
    // Custom header helps backends distinguish XHR from browser navigation
    // and can serve as an additional CSRF signal (double-submit cookie pattern complement)
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: 30_000, // 30 seconds — Argon2id on slow devices may cause longer derive times
})

/**
 * Response interceptor: normalizes all HTTP errors to ApiError instances.
 * This ensures callers never need to inspect raw Axios errors.
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      // Extract backend error message from the standard error envelope
      const message =
        data?.error?.message ??
        (typeof data === 'string' ? data : `HTTP ${status} error`)

      return Promise.reject(new ApiError(message, status))
    }

    if (error.request) {
      // Request was sent but no response received (network error, timeout)
      return Promise.reject(new ApiError('Brak odpowiedzi od serwera. Sprawdź połączenie sieciowe.', 0))
    }

    // Something went wrong setting up the request
    return Promise.reject(new ApiError(error.message || 'Nieznany błąd klienta.', 0))
  },
)

export default apiClient
