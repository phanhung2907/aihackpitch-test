import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { BankingTable } from '@/features/banking/components/banking-table'
import { PageShell } from '@/features/banking/components/page-shell'
import { QueryBoundary } from '@/features/banking/components/query-boundary'
import {
  accountStatusLabels,
  accountStatusVariants,
} from '@/features/banking/data/labels'
import { customerNamer } from '@/features/banking/data/lookup'
import { useAccounts, useCustomers } from '@/features/banking/data/queries'
import { type Account } from '@/features/banking/data/types'

export function Accounts() {
  const accounts = useAccounts()
  const customers = useCustomers()

  const columns = useMemo<ColumnDef<Account>[]>(() => {
    const nameOf = customerNamer(customers.data)
    return [
      {
        accessorKey: 'number',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Số tài khoản' />
        ),
        cell: ({ row }) => (
          <div className='font-mono font-medium'>{row.original.number}</div>
        ),
      },
      {
        id: 'customer',
        header: 'Chủ tài khoản',
        cell: ({ row }) => nameOf(row.original.customer_id),
      },
      {
        accessorKey: 'label',
        header: 'Loại',
        cell: ({ row }) => (
          <span className='text-muted-foreground'>{row.original.label}</span>
        ),
      },
      {
        accessorKey: 'posted_balance',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Số dư đã ghi sổ' />
        ),
        cell: ({ row }) => (
          <span className='font-mono'>
            {formatVnd(row.original.posted_balance)}
          </span>
        ),
        meta: { className: 'text-end' },
      },
      {
        accessorKey: 'reserved_amount',
        header: 'Đang giữ',
        cell: ({ row }) => {
          const reserved = row.original.reserved_amount
          return (
            <span
              className={
                reserved === '0'
                  ? 'text-muted-foreground font-mono'
                  : 'font-mono'
              }
            >
              {formatVnd(reserved)}
            </span>
          )
        },
        meta: { className: 'text-end' },
      },
      {
        accessorKey: 'available_balance',
        header: 'Khả dụng',
        cell: ({ row }) => (
          <span className='font-mono font-medium'>
            {formatVnd(row.original.available_balance)}
          </span>
        ),
        meta: { className: 'text-end' },
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={accountStatusVariants[row.original.status]}>
            {accountStatusLabels[row.original.status]}
          </Badge>
        ),
        filterFn: (row, id, value) =>
          (value as string[]).includes(row.getValue(id)),
      },
    ]
  }, [customers.data])

  return (
    <PageShell
      title='Tài khoản'
      description='Khả dụng = số dư đã ghi sổ trừ phần đang giữ cho lệnh chờ duyệt. Giữ tiền không làm thay đổi số dư đã ghi sổ.'
    >
      <QueryBoundary isPending={accounts.isPending} error={accounts.error}>
        <BankingTable
          data={accounts.data ?? []}
          columns={columns}
          searchKey='number'
          searchPlaceholder='Tìm theo số tài khoản...'
          filters={[
            {
              columnId: 'status',
              title: 'Trạng thái',
              options: [
                { label: 'Hoạt động', value: 'active' },
                { label: 'Đã khóa', value: 'frozen' },
                { label: 'Đã đóng', value: 'closed' },
              ],
            },
          ]}
        />
      </QueryBoundary>
    </PageShell>
  )
}
