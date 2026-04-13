import { cn } from '@/lib/utils'

export function StatusBanner({
  message,
  type = 'success',
}: {
  message: string
  type?: 'success' | 'error'
}) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border px-4 py-3 text-sm font-medium',
        type === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      )}
    >
      {message}
    </div>
  )
}
