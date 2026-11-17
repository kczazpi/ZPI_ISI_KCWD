/**
 * @module api/notes
 * @description Notes CRUD API endpoints.
 *
 * All endpoints operate on ciphertext — the backend never receives or stores
 * plaintext content. Encryption and decryption happen exclusively in the browser.
 *
 * Implements the API specification from stage_1_architecture.md §7.2.
 */

import apiClient from './client'
import type {
  NoteCreateRequest,
  NoteUpdateRequest,
  NoteResponse,
  NoteUpdateResponse,
  PaginatedNotesResponse,
} from './types'

/** Base path for notes endpoints. */
const NOTES_BASE = '/api/v1/notes'

/**
 * Retrieves a paginated list of the authenticated user's encrypted notes.
 * The response contains ciphertext — decryption happens on the client.
 *
 * @param limit  - Maximum number of notes per page (default: 20, max: 100)
 * @param offset - Number of notes to skip (for pagination)
 */
export async function listNotes(limit = 20, offset = 0): Promise<PaginatedNotesResponse> {
  const response = await apiClient.get<PaginatedNotesResponse>(NOTES_BASE, {
    params: { limit, offset },
  })
  return response.data
}

/**
 * Creates a new encrypted note on the server.
 * The note_id is generated client-side (UUIDv4) so it can be used as AAD
 * during encryption before the server confirms the note's existence.
 *
 * @param payload - Encrypted note payload (ciphertext, nonce_iv, auth_tag, etc.)
 */
export async function createNote(payload: NoteCreateRequest): Promise<NoteResponse> {
  const response = await apiClient.post<NoteResponse>(NOTES_BASE, payload)
  return response.data
}

/**
 * Retrieves a single encrypted note by its ID.
 * Returns 404 for both non-existent and unauthorized notes (IDOR mitigation).
 *
 * @param noteId - UUIDv4 of the note to retrieve
 */
export async function getNote(noteId: string): Promise<NoteResponse> {
  const response = await apiClient.get<NoteResponse>(`${NOTES_BASE}/${noteId}`)
  return response.data
}

/**
 * Updates an existing encrypted note.
 * Uses optimistic concurrency control via the `version` field.
 * Returns 409 Conflict if the version is stale (another device modified the note).
 *
 * The nonce_iv MUST be a fresh random value — reusing the same IV breaks AES-GCM security.
 *
 * @param noteId  - UUIDv4 of the note to update
 * @param payload - Updated encrypted payload with new IV, ciphertext, auth_tag, and version
 */
export async function updateNote(
  noteId: string,
  payload: NoteUpdateRequest,
): Promise<NoteUpdateResponse> {
  const response = await apiClient.put<NoteUpdateResponse>(`${NOTES_BASE}/${noteId}`, payload)
  return response.data
}

/**
 * Permanently deletes a note (Hard Delete).
 * The ciphertext is removed from the database — there is no recovery.
 *
 * @param noteId - UUIDv4 of the note to delete
 */
export async function deleteNote(noteId: string): Promise<void> {
  await apiClient.delete(`${NOTES_BASE}/${noteId}`)
}
