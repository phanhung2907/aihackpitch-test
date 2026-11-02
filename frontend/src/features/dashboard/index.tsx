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
import {
  ruleLabels,
  transactionStatusLabels,
  transactionStatusVariants,
  transactionTypeLabels,
} from '@/features/banking/data/labels'
import {
  accountLabel,
  dashboard,
  fraudAlerts,
  transactionById,
  transactions,
} from '@/features/banking/data/mock'
import { VolumeChart } from './components/volume-chart'

const asOf = new Date(dashboard.as_of)

const openAlerts = fraudAlerts.filter((alert) => alert.status === 'open')

const recentTransactions = [...transactions]
  .sort((a, b) => b.received_at.localeCompare(a.received_at))
  .slice(0, 6)

export function Dashboard() {
  return (
    <PageShell
      title='Tổng quan'
      description={`Số liệu tính đến ${formatDateTime(dashboard.as_of)} (giờ Việt Nam). Dữ liệu demo, chưa nối backend.`}
      actions={
        <Button asChild>
          <Link to='/fraud-alerts'>Vào hàng đợi kiểm duyệt</Link>
        </Button>
      }
    >
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Số dư đã ghi sổ</CardDescription>
            <CardTitle className='text-2xl'>
              {dashboard.total_posted_balance
                ? formatVnd(dashboard.total_posted_balance)
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-muted-foreground text-xs'>
            Tổng trên các tài khoản khách hàng
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Đang giữ cho lệnh chờ</CardDescription>
            <CardTitle className='text-2xl'>
              {dashboard.total_reserved_amount
                ? formatVnd(dashboard.total_reserved_amount)
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
            <CardTitle className='text-2xl'>
              {dashboard.open_alert_count ?? '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-muted-foreground text-xs'>
            {dashboard.oldest_pending_at
              ? `Lệnh cũ nhất: ${formatRelativeAge(dashboard.oldest_pending_at, asOf)}`
              : 'Không có lệnh chờ'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Lệnh đã ghi sổ</CardDescription>
            <CardTitle className='text-2xl'>
              {dashboard.posted_transaction_count}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-muted-foreground text-xs'>
            Trong dữ liệu demo hiện tại
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 lg:grid-cols-7'>
        <Card className='lg:col-span-4'>
          <CardHeader>
            <CardTitle>Giá trị giao dịch theo tháng</CardTitle>
            <CardDescription>Đơn vị: triệu đồng</CardDescription>
          </CardHeader>
          <CardContent className='ps-2'>
            <VolumeChart />
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle>Cảnh báo đang chờ</CardTitle>
            <CardDescription>
              {openAlerts.length} lệnh bị giữ, cần phân tích viên quyết định
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {openAlerts.map((alert) => {
              const transaction = transactionById(alert.transaction_id)
              const matched = alert.results.filter(
                (result) =>
                  result.result === 'matched' || result.result === 'unavailable'
              )
              return (
                <div key={alert.id} className='flex items-start gap-3'>
                  <div className='flex-1 space-y-1'>
                    <div className='flex flex-wrap gap-1'>
                      {matched.map((result) => (
                        <Badge key={result.rule_id} variant='outline'>
                          {ruleLabels[result.rule_id]}
                        </Badge>
                      ))}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {transaction
                        ? `${transactionTypeLabels[transaction.type]} · ${accountLabel(
                            transaction.source_account_id ??
                              transaction.destination_account_id
                          )}`
                        : 'Không rõ giao dịch'}{' '}
                      · {formatRelativeAge(alert.created_at, asOf)}
                    </p>
                  </div>
                  <span className='font-mono text-sm font-medium'>
                    {transaction ? formatVnd(transaction.amount) : '—'}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Giao dịch gần đây</CardTitle>
          <CardDescription>
            Thời gian nhận do máy chủ đóng dấu, hiển thị theo giờ Việt Nam
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {recentTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className='flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0'
            >
              <div>
                <p className='text-sm font-medium'>
                  {transactionTypeLabels[transaction.type]} ·{' '}
                  <span className='font-mono'>
                    {accountLabel(
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
                <Badge variant={transactionStatusVariants[transaction.status]}>
                  {transactionStatusLabels[transaction.status]}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  )
}
