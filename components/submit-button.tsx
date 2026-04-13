'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubmitButtonProps {
  children: React.ReactNode
  className?: string
  pendingText?: string
}

export function SubmitButton({ children, className, pendingText }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'inline-flex items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {pendingText ?? 'Menyimpan...'}
        </>
      ) : (
        children
      )}
    </button>
  )
}
