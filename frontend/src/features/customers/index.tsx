import { type ColumnDef } from '@tanstack/react-table'
import { formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { BankingTable } from '@/features/banking/components/banking-table'
import { PageShell } from '@/features/banking/components/page-shell'
import { customerStatusLabels } from '@/features/banking/data/labels'
import { accounts, customers } from '@/features/banking/data/mock'
import { type Customer } from '@/features/banking/data/types'

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'full_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Khách hàng' />
    ),
    cell: ({ row }) => (
      <div className='font-medium'>{row.original.full_name}</div>
    ),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <span className='text-muted-foreground'>{row.original.email}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: 'Số điện thoại',
  },
  {
    id: 'accounts',
    header: 'Số tài khoản',
    cell: ({ row }) =>
      accounts.filter((account) => account.customer_id === row.original.id)
        .length,
    meta: { className: 'text-end' },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === 'active' ? 'secondary' : 'outline'}
      >
        {customerStatusLabels[row.original.status]}
      </Badge>
    ),
    filterFn: (row, id, value) => (value as string[]).includes(row.getValue(id)),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Ngày mở' />
    ),
    cell: ({ row }) => formatDate(row.original.created_at),
  },
]

export function Customers() {
  return (
    <PageShell
      title='Khách hàng'
      description='Danh sách khách hàng và số tài khoản đang mở. Khách hàng có lịch sử tài chính chỉ được lưu trữ, không xóa.'
    >
      <BankingTable
        data={customers}
        columns={columns}
        searchKey='full_name'
        searchPlaceholder='Tìm theo tên...'
        filters={[
          {
            columnId: 'status',
            title: 'Trạng thái',
            options: [
              { label: 'Hoạt động', value: 'active' },
              { label: 'Lưu trữ', value: 'archived' },
            ],
          },
        ]}
      />
    </PageShell>
  )
}
