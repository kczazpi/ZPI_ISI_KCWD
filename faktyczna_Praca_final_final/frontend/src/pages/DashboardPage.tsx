/**
 * @module pages/DashboardPage
 * @description Main application dashboard for authenticated users.
 *
 * Layout:
 * - AppHeader (top): user info + logout
 * - Sidebar (left): note list with pagination
 * - Main panel (right): note editor (create or edit)
 *
 * On mobile, a tab-based view toggles between list and editor.
 */

import { useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { NoteList } from '@/components/notes/NoteList'
import { NoteEditor } from '@/components/notes/NoteEditor'
import type { DecryptedNote } from '@/hooks/useNotes'

export function DashboardPage() {
  const [selectedNote, setSelectedNote] = useState<DecryptedNote | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // Mobile: 'list' or 'editor' tab
  const [mobileTab, setMobileTab] = useState<'list' | 'editor'>('list')

  const handleSelectNote = (note: DecryptedNote | null) => {
    setSelectedNote(note)
    setIsCreatingNew(false)
    setMobileTab('editor')
  }

  const handleNewNote = () => {
    setSelectedNote(null)
    setIsCreatingNew(true)
    setMobileTab('editor')
  }

  const handleEditorClose = () => {
    setSelectedNote(null)
    setIsCreatingNew(false)
    setMobileTab('list')
  }

  const showEditor = isCreatingNew || selectedNote !== null

  return (
    <div className="dashboard">
      <AppHeader />

      {/* Mobile tab switcher */}
      <div className="dashboard__mobile-tabs" role="tablist" aria-label="Widok">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'list'}
          className={`dashboard__mobile-tab ${mobileTab === 'list' ? 'dashboard__mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          📋 Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'editor'}
          className={`dashboard__mobile-tab ${mobileTab === 'editor' ? 'dashboard__mobile-tab--active' : ''}`}
          onClick={() => setMobileTab('editor')}
        >
          ✏️ Edytor
        </button>
      </div>

      <div className="dashboard__layout">
        {/* Sidebar: Note list */}
        <aside
          className={`dashboard__sidebar ${mobileTab === 'list' ? 'dashboard__sidebar--visible' : ''}`}
          aria-label="Lista notatek"
        >
          <div className="dashboard__sidebar-header">
            <h2 className="dashboard__sidebar-title">Moje notatki</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleNewNote}
              aria-label="Utwórz nową notatkę"
            >
              + Nowa
            </button>
          </div>

          <NoteList
            selectedNoteId={selectedNote?.id ?? null}
            onSelectNote={handleSelectNote}
          />
        </aside>

        {/* Main: Editor */}
        <main
          className={`dashboard__main ${mobileTab === 'editor' ? 'dashboard__main--visible' : ''}`}
          aria-label="Edytor notatki"
        >
          {showEditor ? (
            <NoteEditor note={selectedNote} onClose={handleEditorClose} />
          ) : (
            <div className="dashboard__welcome">
              <div className="dashboard__welcome-icon" aria-hidden="true">🔒</div>
              <h2 className="dashboard__welcome-title">Bezpieczne notatki E2EE</h2>
              <p className="dashboard__welcome-text">
                Wybierz notatkę z listy lub utwórz nową. Treść jest szyfrowana
                lokalnie przed wysłaniem — serwer nigdy nie widzi Twoich danych.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleNewNote}
              >
                + Nowa notatka
              </button>
              <div className="dashboard__welcome-info">
                <span className="dashboard__crypto-badge">AES-256-GCM</span>
                <span className="dashboard__crypto-badge">Argon2id KDF</span>
                <span className="dashboard__crypto-badge">Zero-Knowledge</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
