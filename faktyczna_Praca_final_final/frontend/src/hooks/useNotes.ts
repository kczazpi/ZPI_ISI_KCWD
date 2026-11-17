/**
 * @module hooks/useNotes
 * @description React Query hooks for encrypted notes CRUD operations.
 *
 * These hooks handle the full E2EE lifecycle:
 * - Fetching ciphertexts from the backend
 * - Decrypting them client-side using K_master
 * - Encrypting plaintext before sending to the backend
 * - Cache invalidation after mutations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { createNote, deleteNote, listNotes, updateNote } from '@/api/notes'
import { decryptNote, encryptNote, type NotePlaintext } from '@/crypto/cipher'
import { getMasterKey } from '@/crypto/keys'
import type { NoteResponse } from '@/api/types'

/** Query key factory for consistent cache management. */
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (limit: number, offset: number) => [...noteKeys.lists(), { limit, offset }] as const,
}

/** A note with decrypted plaintext, ready for display. */
export interface DecryptedNote {
  id: string
  title: string
  content: string
  tags: string[]
  version: number
  created_at: string
  updated_at: string
  /** Set to true if decryption fails — display a placeholder instead of crashing. */
  decryptionError?: boolean
}

/**
 * Attempts to decrypt a single NoteResponse.
 * On failure, returns a DecryptedNote with decryptionError=true so the UI
 * can show a graceful placeholder rather than crashing.
 */
async function tryDecryptNote(
  note: NoteResponse,
  masterKey: CryptoKey,
): Promise<DecryptedNote> {
  try {
    const plaintext = await decryptNote(masterKey, note.id, note)
    return {
      id: note.id,
      title: plaintext.title,
      content: plaintext.content,
      tags: plaintext.tags ?? [],
      version: note.version,
      created_at: note.created_at,
      updated_at: note.updated_at,
    }
  } catch {
    return {
      id: note.id,
      title: '[Błąd deszyfrowania]',
      content: '',
      tags: [],
      version: note.version,
      created_at: note.created_at,
      updated_at: note.updated_at,
      decryptionError: true,
    }
  }
}

/**
 * Hook for fetching and decrypting the user's note list.
 *
 * @param limit  - Page size
 * @param offset - Page offset
 */
export function useNotes(limit = 20, offset = 0) {
  return useQuery({
    queryKey: noteKeys.list(limit, offset),
    queryFn: async () => {
      const masterKey = getMasterKey()
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.')
      }

      const response = await listNotes(limit, offset)

      // Decrypt all notes in parallel
      const decrypted = await Promise.all(
        response.items.map((note) => tryDecryptNote(note, masterKey)),
      )

      return {
        items: decrypted,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
      }
    },
    // Don't retry on auth errors — user needs to re-login
    enabled: getMasterKey() !== null,
  })
}

/**
 * Hook for creating a new encrypted note.
 * Generates a client-side UUIDv4 and encrypts plaintext before sending to backend.
 */
export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (plaintext: NotePlaintext) => {
      const masterKey = getMasterKey()
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.')
      }

      // Generate note_id client-side so it can be used as AAD during encryption
      const noteId = uuidv4()
      const encrypted = await encryptNote(masterKey, noteId, plaintext)

      return createNote({
        id: noteId,
        ...encrypted,
      })
    },
    onSuccess: () => {
      // Invalidate all note list queries to trigger refetch
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
  })
}

/**
 * Hook for updating an existing encrypted note.
 * Re-encrypts the plaintext with a new random IV before sending to backend.
 * Sends the current version for optimistic concurrency control.
 */
export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      noteId,
      plaintext,
      currentVersion,
    }: {
      noteId: string
      plaintext: NotePlaintext
      currentVersion: number
    }) => {
      const masterKey = getMasterKey()
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.')
      }

      // Re-encrypt with a fresh IV — reusing the previous IV would be a security violation
      const encrypted = await encryptNote(masterKey, noteId, plaintext)

      return updateNote(noteId, {
        ...encrypted,
        version: currentVersion,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
  })
}

/**
 * Hook for permanently deleting a note.
 */
export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
  })
}
