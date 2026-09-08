import type { ReactNode } from 'react'

/**
 * The shared shell. Instrument, not brochure: dense, quiet, neutral ground,
 * nothing decorative. See docs/SPEC.md section 10.
 */
export function Panel({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border border-neutral-800 bg-neutral-900/40">
      <header className="flex items-baseline justify-between border-b border-neutral-800 px-3 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">
          {title}
        </h2>
        {aside !== undefined && (
          <span className="text-[11px] text-neutral-500">{aside}</span>
        )}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

/**
 * One figure. `tone` marks a number that is telling the user something, never
 * that they have made a mistake — guardrails inform, they do not interrupt.
 */
export function Figure({
  label,
  value,
  note,
  tone = 'plain',
  size = 'normal',
}: {
  label: string
  value: string
  note?: ReactNode
  tone?: 'plain' | 'attention' | 'inversion'
  size?: 'normal' | 'large'
}) {
  const valueTone =
    tone === 'attention'
      ? 'text-amber-300'
      : tone === 'inversion'
        ? 'text-rose-300'
        : 'text-neutral-100'

  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div
        className={`${size === 'large' ? 'text-2xl' : 'text-lg'} leading-tight ${valueTone}`}
      >
        {value}
      </div>
      {note !== undefined && (
        <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">{note}</div>
      )}
    </div>
  )
}

export function Button({
  onClick,
  children,
  variant = 'normal',
}: {
  onClick: () => void
  children: ReactNode
  variant?: 'normal' | 'quiet'
}) {
  const base =
    'border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400'
  const look =
    variant === 'quiet'
      ? 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
      : 'border-neutral-700 bg-neutral-800/60 text-neutral-200 hover:bg-neutral-700/60'

  return (
    <button type="button" onClick={onClick} className={`${base} ${look}`}>
      {children}
    </button>
  )
}

/** A number that opens into the rows behind it. SPEC section 10. */
export function Disclosure({
  summary,
  count,
  children,
}: {
  summary: ReactNode
  count: number
  children: ReactNode
}) {
  if (count === 0) return <div className="text-neutral-500">{summary}</div>

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-neutral-300 marker:content-none hover:text-neutral-100">
        <span className="mr-1 inline-block text-neutral-600 group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="mt-2 border-l border-neutral-800 pl-3">{children}</div>
    </details>
  )
}
