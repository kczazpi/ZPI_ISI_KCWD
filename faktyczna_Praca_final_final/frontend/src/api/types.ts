/**
 * @module api/types
 * @description TypeScript interfaces matching the backend Pydantic schemas.
 * Keep these in sync with the backend schemas in backend/app/schemas/.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface KdfParams {
  algorithm: string
  m: number
  t: number
  p: number
}

export interface KdfParamsResponse {
  kdf_salt: string
  kdf_params: KdfParams
}

export interface UserRegisterRequest {
  email: string
  auth_hash: string
  kdf_salt: string
  kdf_params: KdfParams
}

export interface UserLoginRequest {
  email: string
  auth_hash: string
}

export interface UserResponse {
  id: string
  email: string
  is_active: boolean
  created_at: string
}

export interface LoginResponse {
  user: UserResponse
  message: string
}

export interface MessageResponse {
  message: string
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface NoteCreateRequest {
  id?: string
  ciphertext: string
  nonce_iv: string
  auth_tag: string
  crypto_version: number
}

export interface NoteUpdateRequest {
  ciphertext: string
  nonce_iv: string
  auth_tag: string
  crypto_version: number
  version: number
}

export interface NoteResponse {
  id: string
  ciphertext: string
  nonce_iv: string
  auth_tag: string
  crypto_version: number
  version: number
  created_at: string
  updated_at: string
}

export interface NoteUpdateResponse {
  id: string
  version: number
  updated_at: string
}

export interface PaginatedNotesResponse {
  items: NoteResponse[]
  total: number
  limit: number
  offset: number
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export interface ApiErrorDetail {
  message: string
  status_code: number
  details?: Record<string, unknown>
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
}
