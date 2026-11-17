/**
 * @module components/ui/LoadingSpinner
 * @description Accessible loading indicator for async operations.
 */

import clsx from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function LoadingSpinner({ size = 'md', label = 'Ładowanie...' }: LoadingSpinnerProps) {
  return (
    <div
      className={clsx('spinner', `spinner--${size}`)}
      role="status"
      aria-label={label}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="31.4"
          strokeDashoffset="10"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
