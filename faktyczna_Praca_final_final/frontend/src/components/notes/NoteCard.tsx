/**
 * @module components/notes/NoteCard
 * @description Displays a decrypted note card in the note list.
 * Shows title, preview of content, and action buttons.
 */

import type { DecryptedNote } from '@/hooks/useNotes'

interface NoteCardProps {
  note: DecryptedNote
  isSelected: boolean
  onSelect: (note: DecryptedNote) => void
  onDelete: (noteId: string) => void
}

/**
 * Formats an ISO date string to a human-readable localized format.
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function NoteCard({ note, isSelected, onSelect, onDelete }: NoteCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Czy na pewno chcesz usunąć notatkę "${note.title}"? Tej operacji nie można cofnąć.`)) {
      onDelete(note.id)
    }
  }

  return (
    <article
      className={`note-card ${isSelected ? 'note-card--selected' : ''} ${note.decryptionError ? 'note-card--error' : ''}`}
      onClick={() => !note.decryptionError && onSelect(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !note.decryptionError) {
          onSelect(note)
        }
      }}
      aria-label={`Notatka: ${note.title}`}
      aria-selected={isSelected}
    >
      <div className="note-card__content">
        {note.decryptionError ? (
          <div className="note-card__error-indicator" title="Nie można odszyfrować tej notatki">
            🔒 Błąd deszyfrowania
          </div>
        ) : null}

        <h3 className="note-card__title">
          {note.title || <span className="note-card__untitled">Bez tytułu</span>}
        </h3>

        {!note.decryptionError && note.content && (
          <p className="note-card__preview">
            {note.content.slice(0, 120)}{note.content.length > 120 ? '…' : ''}
          </p>
        )}

        {note.tags.length > 0 && (
          <div className="note-card__tags">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="tag tag--more">+{note.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="note-card__meta">
          <time dateTime={note.updated_at} className="note-card__date">
            {formatDate(note.updated_at)}
          </time>
          <span className="note-card__version" title="Wersja notatki">
            v{note.version}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="note-card__delete"
        aria-label={`Usuń notatkę "${note.title}"`}
        onClick={handleDelete}
        title="Usuń notatkę"
      >
        🗑
      </button>
    </article>
  )
}
