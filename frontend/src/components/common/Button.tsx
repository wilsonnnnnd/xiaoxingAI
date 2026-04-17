import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const sizeCls = {
    sm: 'h-9 px-4 text-[13px] rounded-2xl',
    md: 'h-10 px-5 text-[14px] rounded-2xl',
    lg: 'h-11 px-5.5 text-[15px] rounded-[20px]',
  }[size]

  const baseCls = [
    'group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap',
    'font-medium tracking-[-0.02em]',
    'transition-all duration-300 ease-out',
    'transition-colors',
    'select-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    'active:scale-[0.985]',
  ].join(' ')

  const variantCls = {
    // ✅ 主按钮：浅蓝底 + 深色字 + 稍微突出
    primary: [
      'border border-sky-200/60',
      'bg-[linear-gradient(180deg,rgba(210,230,255,0.98)_0%,rgba(195,222,255,0.98)_100%)]',
      'text-[#0b3c5d]',

      'shadow-[0_12px_34px_rgba(24,162,217,0.18),inset_0_1px_0_rgba(255,255,255,0.85)]',

      'hover:-translate-y-[1px]',
      'hover:brightness-[1.02]',
      'hover:text-[#082f49]',

      // 👇 新增（重点）
      'group-hover:bg-slate-50/40',

      'hover:shadow-[0_18px_44px_rgba(24,162,217,0.22),inset_0_1px_0_rgba(255,255,255,0.92)]',

      'active:translate-y-0 active:scale-[0.985]',
    ].join(' '),

    // ✅ 次按钮：和 Card 完全一致语言
    secondary: [
      'border border-black/[0.06]',
      'bg-white/72 backdrop-blur-xl',
      'text-slate-700',

      'shadow-[0_8px_24px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.88)]',

      'group-hover:bg-slate-50',

      'hover:-translate-y-0.5',
      'hover:text-slate-900',

      'hover:shadow-[0_14px_34px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.94)]',
    ].join(' '),

    // ✅ ghost：最轻层级
    ghost: [
      'border border-transparent',
      'bg-transparent',
      'text-slate-600',

      'group-hover:bg-slate-50',

      'hover:text-slate-900',
      'hover:border-black/[0.06]',

      'hover:shadow-[0_8px_22px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.75)]',
    ].join(' '),
  }[variant]

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      className={`${baseCls} ${sizeCls} ${variantCls} ${className}`}
      {...props}
    >
      {/* 🌫️ 顶部柔光（统一 Card 语言） */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.05)_50%,rgba(255,255,255,0)_100%)]" />

      {/* ✨ 顶部细高光线 */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

      {/* 💡 光晕（只给有背景的按钮） */}
      {variant !== 'ghost' && (
        <span className="pointer-events-none absolute right-[-18px] top-[-18px] h-16 w-16 rounded-full bg-white/45 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      )}

      {/* 内容 */}
      <span className="relative inline-flex items-center gap-2">
        {loading && (
          <span
            className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${variant === 'primary'
              ? 'border-sky-300/40 border-t-[#0b3c5d]'
              : 'border-slate-300 border-t-slate-700'
              }`}
          />
        )}
        <span>{children}</span>
      </span>
    </button>
  )
}