import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

let openModalCount = 0
let previousBodyOverflow: string | null = null

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  const titleId = React.useId()
  const modalRef = React.useRef<HTMLDivElement | null>(null)
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    openModalCount += 1
    if (openModalCount === 1) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow ?? ''
        previousBodyOverflow = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const raf = window.requestAnimationFrame(() => {
      modalRef.current?.focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocusedRef.current?.focus?.()
      previouslyFocusedRef.current = null
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(248,250,252,0.55)] backdrop-blur-md" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),rgba(255,255,255,0.16)_38%,rgba(15,23,42,0.10)_100%)]" />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'group relative w-full overflow-hidden rounded-[28px]',
          sizeClasses[size],
          'border border-white/70 bg-white/78 backdrop-blur-2xl',
          'shadow-[0_24px_80px_rgba(15,23,42,0.12)]',
          'animate-in fade-in zoom-in-95 duration-200',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* accent haze */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(217,235,255,0.55),rgba(255,255,255,0)_42%,rgba(255,255,255,0.28)_100%)]" />

        {/* top hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />

        {/* glow */}
        <div className="pointer-events-none absolute right-[-28px] top-[-28px] h-28 w-28 rounded-full bg-white/60 blur-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950"
              >
                {title}
              </h3>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className={[
                'relative inline-flex h-9 w-9 items-center justify-center rounded-full',
                'border border-white/70 bg-white/72 backdrop-blur-xl',
                'text-slate-500',
                'shadow-[0_8px_24px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.9)]',
                'transition-all duration-200',
                'hover:-translate-y-[0.5px] hover:bg-white/88 hover:text-slate-900',
                'hover:shadow-[0_12px_28px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.96)]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                'active:scale-[0.98]',
              ].join(' ')}
            >
              <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_52%,rgba(255,255,255,0)_100%)]" />
              <span className="relative text-xl leading-none">&times;</span>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6 text-sm leading-7 text-slate-600">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 bg-white/35 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
