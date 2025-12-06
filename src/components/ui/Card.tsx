import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`
        bg-white/5 border border-white/10
        rounded-2xl p-6
        ${className}
      `}
    >
      {children}
    </div>
  )
}
