import { ReversalAction } from '@/features/banking/actions'
import { type ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { BankingTable } from '@/features/banking/components/banking-table'
import { PageShell } from '@/features/banking/components/page-shell'
import {
  ruleLabels,
  transactionStatusLabels,
  transactionStatusVariants,
  transactionTypeLabels,
} from '@/features/banking/data/labels'
import { useBankingData } from '@/features/banking/api/data'
import { type Transaction } from '@/features/banking/data/types'
import { NewTransactionDialog } from './components/new-transaction-dialog'

export function Transactions() {
  const { accountLabel, transactions } = useBankingData()
  const columns: ColumnDef<Transaction>[] = [
    { id:'manage', header:'Thao tác', cell:({row})=><ReversalAction transaction={row.original} /> },
  {
    accessorKey: 'received_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Nhận lúc' />
    ),
    cell: ({ row }) => (
      <span className='whitespace-nowrap'>
        {formatDateTime(row.original.received_at)}
      </span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Loại',
    cell: ({ row }) => transactionTypeLabels[row.original.type],
    filterFn: (row, id, value) => (value as string[]).includes(row.getValue(id)),
  },
  {
    id: 'source',
    header: 'Nguồn',
    cell: ({ row }) => (
      <span className='font-mono'>
        {accountLabel(row.original.source_account_id)}
      </span>
    ),
  },
  {
    id: 'destination',
    header: 'Nhận',
    cell: ({ row }) => (
      <span className='font-mono'>
        {accountLabel(row.original.destination_account_id)}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Số tiền' />
    ),
    cell: ({ row }) => (
      <span className='font-mono font-medium'>
        {formatVnd(row.original.amount)}
      </span>
    ),
    sortingFn: (a, b) => {
      const left = BigInt(a.original.amount)
      const right = BigInt(b.original.amount)
      return left === right ? 0 : left < right ? -1 : 1
    },
    meta: { className: 'text-end' },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <Badge variant={transactionStatusVariants[row.original.status]}>
        {transactionStatusLabels[row.original.status]}
      </Badge>
    ),
    filterFn: (row, id, value) => (value as string[]).includes(row.getValue(id)),
  },
  {
    id: 'fraud',
    header: 'Lý do giữ',
    cell: ({ row }) =>
      row.original.fraud_reason_codes.length ? (
        <div className='flex flex-wrap gap-1'>
          {row.original.fraud_reason_codes.map((code) => (
            <Badge key={code} variant='outline'>
              {ruleLabels[code]}
            </Badge>
          ))}
        </div>
      ) : (
        <span className='text-muted-foreground'>—</span>
      ),
  },
]

  return (
    <PageShell
      title='Giao dịch'
      description='Thời gian nhận do máy chủ đóng dấu theo UTC và hiển thị theo giờ Asia/Ho_Chi_Minh. Lệnh bị giữ chưa ghi sổ.'
      actions={<NewTransactionDialog />}
    >
      <BankingTable
        data={transactions}
        columns={columns}
        filters={[
          {
            columnId: 'type',
            title: 'Loại',
            options: [
              { label: 'Gửi tiền', value: 'deposit' },
              { label: 'Rút tiền', value: 'withdrawal' },
              { label: 'Chuyển nội bộ', value: 'transfer' },
            ],
          },
          {
            columnId: 'status',
            title: 'Trạng thái',
            options: [
              { label: 'Chờ duyệt', value: 'pending_review' },
              { label: 'Đã ghi sổ', value: 'posted' },
              { label: 'Từ chối', value: 'rejected' },
              { label: 'Đã đảo', value: 'reversed' },
            ],
          },
        ]}
        searchPlaceholder='Lọc giao dịch...'
      />
    </PageShell>
  )
}
