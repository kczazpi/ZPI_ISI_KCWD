/**
 * @module api/auth
 * @description Authentication API endpoints.
 *
 * These functions correspond to the backend /api/v1/auth/* routes defined in
 * stage_1_architecture.md §7.1 and implemented in stage_3_auth_and_sessions.md.
 *
 * Security note: auth_hash (SHA-256 of K_auth) is the only cryptographic derivative
 * sent to the server. The raw password and K_master are NEVER transmitted.
 */

import apiClient from './client'
import type {
  KdfParamsResponse,
  LoginResponse,
  MessageResponse,
  UserRegisterRequest,
  UserLoginRequest,
  UserResponse,
} from './types'

/** Base path for all auth endpoints. */
const AUTH_BASE = '/api/v1/auth'

/**
 * Retrieves the KDF salt and Argon2id parameters for a given email address.
 * This is the first step of the login flow — called before deriving keys.
 *
 * The backend returns a deterministic fake salt for unknown emails to prevent
 * account enumeration attacks.
 *
 * @param email - The user's email address
 */
export async function getKdfParams(email: string): Promise<KdfParamsResponse> {
  const response = await apiClient.get<KdfParamsResponse>(`${AUTH_BASE}/kdf-params`, {
    params: { email },
  })
  return response.data
}

/**
 * Registers a new user account.
 * The auth_hash is computed client-side from the derived K_auth.
 * The plaintext password MUST NOT be included in this request.
 *
 * @param payload - Registration payload with email, auth_hash, kdf_salt, kdf_params
 */
export async function register(payload: UserRegisterRequest): Promise<UserResponse> {
  const response = await apiClient.post<UserResponse>(`${AUTH_BASE}/register`, payload)
  return response.data
}

/**
 * Authenticates the user and creates a server-side session.
 * On success, the server sets an HttpOnly session cookie — no token is returned
 * in the response body, so JS cannot read or leak it.
 *
 * @param payload - Login payload with email and auth_hash
 */
export async function login(payload: UserLoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(`${AUTH_BASE}/login`, payload)
  return response.data
}

/**
 * Logs out the current session by invalidating it on the server.
 * The session cookie is cleared by the server in the response headers.
 */
export async function logout(): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(`${AUTH_BASE}/logout`)
  return response.data
}

/**
 * Retrieves the currently authenticated user's profile.
 * Returns 401 Unauthorized if the session cookie is missing or expired.
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const response = await apiClient.get<UserResponse>(`${AUTH_BASE}/me`)
  return response.data
}
