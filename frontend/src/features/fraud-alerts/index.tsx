import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatRelativeAge, formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { BankingTable } from '@/features/banking/components/banking-table'
import { PageShell } from '@/features/banking/components/page-shell'
import { QueryBoundary } from '@/features/banking/components/query-boundary'
import {
  alertStatusLabels,
  alertStatusVariants,
  ruleLabels,
} from '@/features/banking/data/labels'
import {
  accountLabeller,
  transactionFinder,
} from '@/features/banking/data/lookup'
import {
  useAccounts,
  useFraudAlerts,
  useTransactions,
} from '@/features/banking/data/queries'
import { type FraudAlert } from '@/features/banking/data/types'
import { AlertReviewSheet } from './components/alert-review-sheet'

export function FraudAlerts() {
  const alerts = useFraudAlerts()
  const transactions = useTransactions()
  const accounts = useAccounts()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const findTransaction = useMemo(
    () => transactionFinder(transactions.data),
    [transactions.data]
  )
  const labelOf = useMemo(
    () => accountLabeller(accounts.data),
    [accounts.data]
  )

  const columns = useMemo<ColumnDef<FraudAlert>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Tạo lúc' />
        ),
        cell: ({ row }) => (
          <div className='whitespace-nowrap'>
            <div>{formatDateTime(row.original.created_at)}</div>
            <div className='text-muted-foreground text-xs'>
              {formatRelativeAge(row.original.created_at)}
            </div>
          </div>
        ),
      },
      {
        id: 'rules',
        header: 'Luật khớp',
        cell: ({ row }) => {
          const matched = row.original.results.filter(
            (result) =>
              result.result === 'matched' || result.result === 'unavailable'
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
          const transaction = findTransaction(row.original.transaction_id)
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
    ],
    [findTransaction]
  )

  const data = alerts.data ?? []
  const selected = data.find((alert) => alert.id === selectedId) ?? null
  const openCount = data.filter((alert) => alert.status === 'open').length

  return (
    <PageShell
      title='Cảnh báo gian lận'
      description={`${openCount} cảnh báo đang chờ xử lý. Mỗi lệnh có thể khớp nhiều luật nhưng chỉ sinh một quyết định giữ.`}
    >
      <QueryBoundary isPending={alerts.isPending} error={alerts.error}>
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
      </QueryBoundary>

      <AlertReviewSheet
        alert={selected}
        transaction={
          selected ? findTransaction(selected.transaction_id) : undefined
        }
        accountLabel={labelOf}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </PageShell>
  )
}
