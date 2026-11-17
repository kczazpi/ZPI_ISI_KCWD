/**
 * @module components/notes/NoteEditor
 * @description Full-screen editor for creating and updating encrypted notes.
 *
 * The editor operates on decrypted plaintext locally.
 * When the user saves, the plaintext is encrypted client-side before being
 * transmitted to the backend. The server never sees the plaintext.
 */

import { useState, useEffect, useRef } from 'react'
import { useCreateNote, useUpdateNote, type DecryptedNote } from '@/hooks/useNotes'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ApiError } from '@/api/client'

interface NoteEditorProps {
  /** The note to edit, or null to create a new note. */
  note: DecryptedNote | null
  /** Called when the user saves or cancels — signals the parent to deselect. */
  onClose: () => void
}

export function NoteEditor({ note, onClose }: NoteEditorProps) {
  const isNewNote = note === null

  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [tagsInput, setTagsInput] = useState(note?.tags.join(', ') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const createMutation = useCreateNote()
  const updateMutation = useUpdateNote()

  const isMutating = createMutation.isPending || updateMutation.isPending

  // Update form when selected note changes
  useEffect(() => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setTagsInput(note?.tags.join(', ') ?? '')
    setError(null)
    setIsSaved(false)
    // Focus title field on new notes
    if (!note) {
      titleRef.current?.focus()
    }
  }, [note])

  const parseTags = (input: string): string[] =>
    input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

  const handleSave = async () => {
    setError(null)
    setIsSaved(false)

    const plaintext = {
      title: title.trim(),
      content: content.trim(),
      tags: parseTags(tagsInput),
    }

    if (!plaintext.title && !plaintext.content) {
      setError('Notatka musi zawierać tytuł lub treść.')
      return
    }

    try {
      if (isNewNote) {
        await createMutation.mutateAsync(plaintext)
        // Reset form after creating new note
        setTitle('')
        setContent('')
        setTagsInput('')
        setIsSaved(true)
        // Auto-dismiss the saved indicator
        setTimeout(() => setIsSaved(false), 2000)
      } else {
        await updateMutation.mutateAsync({
          noteId: note.id,
          plaintext,
          currentVersion: note.version,
        })
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(
            'Konflikt wersji: notatka została zmieniona na innym urządzeniu. ' +
              'Odśwież listę notatek, aby pobrać najnowszą wersję.',
          )
        } else {
          setError(err.message)
        }
      } else {
        setError('Nieoczekiwany błąd podczas zapisywania notatki.')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      void handleSave()
    }
    // Escape to close
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="note-editor" onKeyDown={handleKeyDown}>
      <div className="note-editor__toolbar">
        <div className="note-editor__toolbar-left">
          {!isNewNote && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onClose}
              aria-label="Wróć do listy"
            >
              ← Wróć
            </button>
          )}
          <h2 className="note-editor__heading">
            {isNewNote ? 'Nowa notatka' : 'Edytuj notatkę'}
          </h2>
        </div>

        <div className="note-editor__toolbar-right">
          {isSaved && (
            <span className="note-editor__saved-indicator" role="status">
              ✓ Zapisano
            </span>
          )}
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void handleSave()}
            disabled={isMutating}
            title="Zapisz (Ctrl+S)"
          >
            {isMutating ? <LoadingSpinner size="sm" label="Zapisywanie..." /> : 'Zapisz'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} className="note-editor__error" />}

      {/* Security indicator */}
      <div className="note-editor__e2ee-badge" title="Treść jest szyfrowana lokalnie przed wysłaniem">
        🔒 Szyfrowane End-to-End (AES-256-GCM)
      </div>

      <div className="note-editor__form">
        <input
          ref={titleRef}
          type="text"
          className="note-editor__title-input"
          placeholder="Tytuł notatki..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
          aria-label="Tytuł notatki"
          disabled={isMutating}
        />

        <input
          type="text"
          className="note-editor__tags-input"
          placeholder="Tagi (oddzielone przecinkami): prywatne, praca, ważne..."
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          aria-label="Tagi (opcjonalne)"
          disabled={isMutating}
        />

        <textarea
          className="note-editor__content"
          placeholder="Treść notatki... (szyfrowana przed wysłaniem)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-label="Treść notatki"
          disabled={isMutating}
        />
      </div>

      <div className="note-editor__footer">
        <span className="note-editor__shortcut-hint">Ctrl+S – Zapisz &nbsp;·&nbsp; Esc – Zamknij</span>
        {!isNewNote && (
          <span className="note-editor__version">
            Wersja: {note.version}
          </span>
        )}
      </div>
    </div>
  )
}
