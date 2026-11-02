import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatRelativeAge, formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { BankingTable } from '@/features/banking/components/banking-table'
import { PageShell } from '@/features/banking/components/page-shell'
import {
  alertStatusLabels,
  alertStatusVariants,
  ruleLabels,
} from '@/features/banking/data/labels'
import {
  dashboard,
  fraudAlerts,
  transactionById,
} from '@/features/banking/data/mock'
import { type FraudAlert } from '@/features/banking/data/types'
import { AlertReviewSheet } from './components/alert-review-sheet'

const asOf = new Date(dashboard.as_of)

export function FraudAlerts() {
  // Decisions stay in component state: the demo has no backend to persist them.
  const [resolved, setResolved] = useState<
    Record<string, 'approved' | 'rejected'>
  >({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const data = useMemo(
    () =>
      fraudAlerts.map((alert) =>
        resolved[alert.id]
          ? {
              ...alert,
              status: resolved[alert.id],
              resolved_at: new Date().toISOString(),
            }
          : alert
      ),
    [resolved]
  )

  const selected = data.find((alert) => alert.id === selectedId) ?? null

  const columns: ColumnDef<FraudAlert>[] = [
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Tạo lúc' />
      ),
      cell: ({ row }) => (
        <div className='whitespace-nowrap'>
          <div>{formatDateTime(row.original.created_at)}</div>
          <div className='text-muted-foreground text-xs'>
            {formatRelativeAge(row.original.created_at, asOf)}
          </div>
        </div>
      ),
    },
    {
      id: 'rules',
      header: 'Luật khớp',
      cell: ({ row }) => {
        const matched = row.original.results.filter(
          (result) => result.result === 'matched' || result.result === 'unavailable'
        )
        return (
          <div className='flex flex-wrap gap-1'>
            {matched.map((result) => (
              <Badge key={result.rule_id} variant='outline'>
                {ruleLabels[result.rule_id]}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'amount',
      header: 'Số tiền giữ',
      cell: ({ row }) => {
        const transaction = transactionById(row.original.transaction_id)
        return (
          <span className='font-mono font-medium'>
            {transaction ? formatVnd(transaction.amount) : '—'}
          </span>
        )
      },
      meta: { className: 'text-end' },
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <Badge variant={alertStatusVariants[row.original.status]}>
          {alertStatusLabels[row.original.status]}
        </Badge>
      ),
      filterFn: (row, id, value) =>
        (value as string[]).includes(row.getValue(id)),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          onClick={(event) => {
            event.stopPropagation()
            setSelectedId(row.original.id)
          }}
        >
          {row.original.status === 'open' ? 'Kiểm duyệt' : 'Xem bằng chứng'}
        </Button>
      ),
      meta: { className: 'text-end' },
    },
  ]

  const openCount = data.filter((alert) => alert.status === 'open').length

  return (
    <PageShell
      title='Cảnh báo gian lận'
      description={`${openCount} cảnh báo đang chờ xử lý. Mỗi lệnh có thể khớp nhiều luật nhưng chỉ sinh một quyết định giữ.`}
    >
      <BankingTable
        data={data}
        columns={columns}
        onRowClick={(alert) => setSelectedId(alert.id)}
        searchPlaceholder='Lọc cảnh báo...'
        filters={[
          {
            columnId: 'status',
            title: 'Trạng thái',
            options: [
              { label: 'Chờ xử lý', value: 'open' },
              { label: 'Đã duyệt', value: 'approved' },
              { label: 'Đã từ chối', value: 'rejected' },
            ],
          },
        ]}
      />

      <AlertReviewSheet
        alert={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        onDecision={(alertId, decision) =>
          setResolved((current) => ({
            ...current,
            [alertId]: decision === 'approve' ? 'approved' : 'rejected',
          }))
        }
      />
    </PageShell>
  )
}
