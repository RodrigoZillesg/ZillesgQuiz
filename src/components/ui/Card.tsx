import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`
        bg-white/5 border border-white/10
        rounded-2xl p-6
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
