/**
 * @module pages/NotFoundPage
 * @description 404 fallback page for unmatched routes.
 */

import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="full-page-center">
      <div className="not-found">
        <div className="not-found__code">404</div>
        <h1 className="not-found__title">Strona nie znaleziona</h1>
        <p className="not-found__text">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link to="/" className="btn btn--primary">
          Wróć do strony głównej
        </Link>
      </div>
    </main>
  )
}
