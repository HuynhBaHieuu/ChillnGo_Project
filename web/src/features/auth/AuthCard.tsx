import type * as React from 'react'

import { GlassCard } from '@/components/GlassCard'

interface AuthCardProps {
  title: string
  description: string
  children: React.ReactNode
  footer: React.ReactNode
}

/** Shared shell for /login and /register: centred glass card on the dark theme. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-6 pb-32 pt-32 text-foreground">
      <GlassCard className="animate-fade-rise w-full max-w-md p-8 sm:p-10">
        <h1 className="font-display text-4xl leading-tight tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-8">{children}</div>

        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </GlassCard>
    </div>
  )
}
