/**
 * @module components/notes/NoteList
 * @description Displays the paginated, decrypted list of user notes.
 */

import { useState } from 'react'
import { useNotes, useDeleteNote, type DecryptedNote } from '@/hooks/useNotes'
import { NoteCard } from './NoteCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

const PAGE_SIZE = 20

interface NoteListProps {
  selectedNoteId: string | null
  onSelectNote: (note: DecryptedNote | null) => void
}

export function NoteList({ selectedNoteId, onSelectNote }: NoteListProps) {
  const [page, setPage] = useState(0)
  const offset = page * PAGE_SIZE

  const { data, isLoading, isError, error, refetch } = useNotes(PAGE_SIZE, offset)
  const deleteMutation = useDeleteNote()

  const handleDelete = async (noteId: string) => {
    // If the deleted note was selected, deselect it
    if (selectedNoteId === noteId) {
      onSelectNote(null)
    }
    try {
      await deleteMutation.mutateAsync(noteId)
    } catch {
      // Errors handled via mutation state
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  if (isLoading) {
    return (
      <div className="note-list__loading">
        <LoadingSpinner size="md" label="Pobieranie i odszyfrowywanie notatek..." />
        <p className="note-list__loading-hint">Deszyfrowanie odbywa się lokalnie w przeglądarce</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="note-list__error">
        <ErrorMessage
          message={
            error instanceof Error
              ? error.message
              : 'Błąd podczas pobierania notatek.'
          }
        />
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => void refetch()}
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="note-list__empty">
        <div className="note-list__empty-icon">📝</div>
        <p className="note-list__empty-text">
          Nie masz jeszcze żadnych notatek.
        </p>
        <p className="note-list__empty-hint">
          Kliknij &ldquo;+ Nowa notatka&rdquo;, aby dodać pierwszą.
        </p>
      </div>
    )
  }

  return (
    <div className="note-list">
      <div className="note-list__count">
        <span>{data.total} {data.total === 1 ? 'notatka' : data.total < 5 ? 'notatki' : 'notatek'}</span>
      </div>

      <ul className="note-list__items" role="list">
        {data.items.map((note) => (
          <li key={note.id} role="listitem">
            <NoteCard
              note={note}
              isSelected={note.id === selectedNoteId}
              onSelect={onSelectNote}
              onDelete={(id) => void handleDelete(id)}
            />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="note-list__pagination" aria-label="Paginacja notatek">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Poprzednia strona"
          >
            ← Poprzednia
          </button>
          <span className="note-list__page-info">
            Strona {page + 1} z {totalPages}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Następna strona"
          >
            Następna →
          </button>
        </nav>
      )}
    </div>
  )
}
