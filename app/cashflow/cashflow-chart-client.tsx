'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatRupiah } from '@/lib/utils'

interface MonthSummary {
  month: string
  in: number
  out: number
  net: number
}

export function CashflowChart({ data }: { data: MonthSummary[] }) {
  if (data.length === 0) return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      Belum ada data cashflow.
    </div>
  )

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatRupiah(value),
            name === 'in' ? 'Masuk' : name === 'out' ? 'Keluar' : 'Net',
          ]}
        />
        <Legend formatter={(v) => v === 'in' ? 'Masuk' : v === 'out' ? 'Keluar' : 'Net'} />
        <Bar dataKey="in" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="out" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="net" stroke="#0c0a09" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
