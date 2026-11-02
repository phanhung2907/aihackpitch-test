import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDateTime, formatRelativeAge, formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageShell } from '@/features/banking/components/page-shell'
import { QueryBoundary } from '@/features/banking/components/query-boundary'
import {
  transactionStatusLabels,
  transactionStatusVariants,
  transactionTypeLabels,
} from '@/features/banking/data/labels'
import { accountLabeller } from '@/features/banking/data/lookup'
import {
  useAccounts,
  useDashboard,
  useTransactions,
} from '@/features/banking/data/queries'

export function Dashboard() {
  const dashboard = useDashboard()
  const transactions = useTransactions()
  const accounts = useAccounts()

  const labelOf = useMemo(() => accountLabeller(accounts.data), [accounts.data])

  const recent = useMemo(
    () =>
      [...(transactions.data ?? [])]
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .slice(0, 8),
    [transactions.data]
  )

  const asOf = dashboard.data ? new Date(dashboard.data.as_of) : undefined

  return (
    <PageShell
      title='Tổng quan'
      description={
        dashboard.data
          ? `Vai trò ${dashboard.data.role} · số liệu tính đến ${formatDateTime(dashboard.data.as_of)} (giờ Việt Nam).`
          : 'Đang tải số liệu từ API.'
      }
      actions={
        <Button asChild>
          <Link to='/fraud-alerts'>Vào hàng đợi kiểm duyệt</Link>
        </Button>
      }
    >
      <QueryBoundary isPending={dashboard.isPending} error={dashboard.error}>
        {dashboard.data && (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader className='pb-2'>
                <CardDescription>Số dư đã ghi sổ</CardDescription>
                <CardTitle className='text-xl break-all'>
                  {dashboard.data.total_posted_balance
                    ? formatVnd(dashboard.data.total_posted_balance)
                    : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-xs'>
                Tổng trên các tài khoản bạn được phép xem
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardDescription>Đang giữ cho lệnh chờ</CardDescription>
                <CardTitle className='text-xl break-all'>
                  {dashboard.data.total_reserved_amount
                    ? formatVnd(dashboard.data.total_reserved_amount)
                    : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-xs'>
                Không làm thay đổi số dư đã ghi sổ
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardDescription>Cảnh báo chờ xử lý</CardDescription>
                <CardTitle className='text-xl'>
                  {dashboard.data.open_alert_count ?? '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-xs'>
                {dashboard.data.oldest_pending_at
                  ? `Lệnh cũ nhất: ${formatRelativeAge(dashboard.data.oldest_pending_at, asOf)}`
                  : 'Không có lệnh chờ'}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardDescription>Lệnh đã ghi sổ</CardDescription>
                <CardTitle className='text-xl'>
                  {dashboard.data.posted_transaction_count}
                </CardTitle>
              </CardHeader>
              <CardContent className='text-muted-foreground text-xs'>
                {dashboard.data.managed_user_count === null
                  ? 'Theo phạm vi của vai trò hiện tại'
                  : `${dashboard.data.managed_user_count} người dùng được quản lý`}
              </CardContent>
            </Card>
          </div>
        )}
      </QueryBoundary>

      <Card>
        <CardHeader>
          <CardTitle>Giao dịch gần đây</CardTitle>
          <CardDescription>
            Thời gian nhận do máy chủ đóng dấu, hiển thị theo giờ Việt Nam
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <QueryBoundary
            isPending={transactions.isPending}
            error={transactions.error}
          >
            {recent.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                Chưa có giao dịch nào trong phạm vi của vai trò này.
              </p>
            ) : (
              recent.map((transaction) => (
                <div
                  key={transaction.id}
                  className='flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0'
                >
                  <div>
                    <p className='text-sm font-medium'>
                      {transactionTypeLabels[transaction.type]} ·{' '}
                      <span className='font-mono'>
                        {labelOf(
                          transaction.source_account_id ??
                            transaction.destination_account_id
                        )}
                      </span>
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {formatDateTime(transaction.received_at)}
                    </p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <span className='font-mono text-sm'>
                      {formatVnd(transaction.amount)}
                    </span>
                    <Badge
                      variant={transactionStatusVariants[transaction.status]}
                    >
                      {transactionStatusLabels[transaction.status]}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </QueryBoundary>
        </CardContent>
      </Card>
    </PageShell>
  )
}
