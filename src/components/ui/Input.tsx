import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3
            bg-white/5 border border-white/10
            rounded-xl text-text-primary
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            transition-colors
            ${error ? 'border-error focus:ring-error' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
