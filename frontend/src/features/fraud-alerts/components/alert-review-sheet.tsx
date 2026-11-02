import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { formatDateTime, formatVnd } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  alertStatusLabels,
  locationSourceLabels,
  ruleDescriptions,
  ruleLabels,
  ruleResultLabels,
  ruleResultVariants,
  transactionStatusLabels,
  transactionTypeLabels,
} from '@/features/banking/data/labels'
import {
  newIdempotencyKey,
  useReviewTransaction,
} from '@/features/banking/data/queries'
import {
  type FraudAlert,
  type RuleResult,
  type Transaction,
} from '@/features/banking/data/types'

const MIN_REASON = 10
const MAX_REASON = 1000

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN:
    'Không đủ quyền: người tạo lệnh không được tự duyệt lệnh của mình.',
  SELF_APPROVAL_FORBIDDEN:
    'Người tạo lệnh không được tự duyệt lệnh của mình.',
  INSUFFICIENT_FUNDS:
    'Số dư khả dụng không còn đủ để ghi sổ, lệnh vẫn đang chờ.',
  CONFLICT: 'Điều kiện ghi sổ không đạt, lệnh vẫn đang chờ và tiền vẫn bị giữ.',
  ALREADY_REVIEWED: 'Cảnh báo này đã có quyết định.',
  CSRF_FAILED: 'Token CSRF không hợp lệ, đăng nhập lại.',
}

type AlertReviewSheetProps = {
  alert: FraudAlert | null
  transaction: Transaction | undefined
  accountLabel: (accountId: string | null) => string
  onOpenChange: (open: boolean) => void
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='grid grid-cols-[11rem_1fr] gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-mono break-all'>{value}</span>
    </div>
  )
}

function RuleEvidence({ result }: { result: RuleResult }) {
  return (
    <div className='rounded-md border p-3'>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <span className='font-medium'>{ruleLabels[result.rule_id]}</span>
        <Badge variant={ruleResultVariants[result.result]}>
          {ruleResultLabels[result.result]}
        </Badge>
        <code className='text-muted-foreground text-xs'>{result.rule_id}</code>
      </div>
      <p className='text-muted-foreground mb-3 text-sm'>
        {ruleDescriptions[result.rule_id]}
      </p>
      <div className='space-y-1'>
        <EvidenceRow label='Ngưỡng' value={result.threshold} />
        <EvidenceRow label='Giá trị quan sát' value={result.observed ?? '—'} />
        <EvidenceRow
          label='Số tiền lệnh này'
          value={formatVnd(result.current_amount)}
        />
        <EvidenceRow
          label='Nhận lúc'
          value={formatDateTime(result.current_received_at)}
        />
        {result.candidate_transaction_id && (
          <>
            <EvidenceRow
              label='Lệnh đối chiếu'
              value={result.candidate_transaction_id}
            />
            <EvidenceRow
              label='Số tiền đối chiếu'
              value={
                result.candidate_amount
                  ? formatVnd(result.candidate_amount)
                  : '—'
              }
            />
            <EvidenceRow
              label='Nhận lúc (đối chiếu)'
              value={
                result.candidate_received_at
                  ? formatDateTime(result.candidate_received_at)
                  : '—'
              }
            />
          </>
        )}
        <EvidenceRow
          label='Nguồn vị trí'
          value={locationSourceLabels[result.location_source]}
        />
        <EvidenceRow
          label='Tọa độ lệnh này'
          value={
            result.current_location
              ? `${result.current_location.latitude}, ${result.current_location.longitude}`
              : 'không có'
          }
        />
        <EvidenceRow
          label='Tọa độ đối chiếu'
          value={
            result.candidate_location
              ? `${result.candidate_location.latitude}, ${result.candidate_location.longitude}`
              : 'không có'
          }
        />
      </div>
    </div>
  )
}

export function AlertReviewSheet({
  alert,
  transaction,
  accountLabel,
  onOpenChange,
}: AlertReviewSheetProps) {
  const [reason, setReason] = useState('')
  // A decision retry must reuse its key; a changed decision or reason is a new
  // command and gets a new one.
  const keys = useRef(new Map<string, string>())
  const review = useReviewTransaction()

  const reasonTooShort = reason.trim().length < MIN_REASON
  const canDecide =
    alert?.status === 'open' && !reasonTooShort && !review.isPending

  async function decide(decision: 'approve' | 'reject') {
    if (!alert || !canDecide) return
    const trimmed = reason.trim()
    const fingerprint = `${alert.transaction_id}:${decision}:${trimmed}`
    let key = keys.current.get(fingerprint)
    if (!key) {
      key = newIdempotencyKey()
      keys.current.set(fingerprint, key)
    }

    try {
      const updated = await review.mutateAsync({
        transactionId: alert.transaction_id,
        decision,
        reason: trimmed,
        idempotencyKey: key,
      })
      toast.success(
        `Lệnh chuyển sang: ${transactionStatusLabels[updated.status]}`
      )
      setReason('')
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? (ERROR_MESSAGES[error.code] ?? `${error.code}: ${error.message}`)
          : 'Không gọi được API. Kiểm tra backend đang chạy.'
      toast.error(message)
    }
  }

  return (
    <Sheet
      open={Boolean(alert)}
      onOpenChange={(open) => {
        if (!open) setReason('')
        onOpenChange(open)
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
        {alert && (
          <>
            <SheetHeader>
              <SheetTitle className='flex items-center gap-2'>
                Kiểm duyệt cảnh báo
                <Badge variant='outline'>
                  {alertStatusLabels[alert.status]}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                Bằng chứng là ảnh chụp tại thời điểm đánh giá theo bộ luật phiên
                bản {alert.rule_version}. Duyệt không chạy lại luật.
              </SheetDescription>
            </SheetHeader>

            <div className='flex-1 space-y-4 overflow-y-auto px-4'>
              <div className='space-y-1'>
                <h4 className='text-sm font-medium'>Giao dịch liên quan</h4>
                {transaction ? (
                  <div className='space-y-1'>
                    <EvidenceRow
                      label='Loại'
                      value={transactionTypeLabels[transaction.type]}
                    />
                    <EvidenceRow
                      label='Số tiền'
                      value={formatVnd(transaction.amount)}
                    />
                    <EvidenceRow
                      label='Trạng thái'
                      value={transactionStatusLabels[transaction.status]}
                    />
                    <EvidenceRow
                      label='Tài khoản nguồn'
                      value={accountLabel(transaction.source_account_id)}
                    />
                    <EvidenceRow
                      label='Tài khoản nhận'
                      value={accountLabel(transaction.destination_account_id)}
                    />
                    <EvidenceRow label='Mã lệnh' value={transaction.id} />
                  </div>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    Giao dịch không nằm trong trang lệnh hiện tại; mã lệnh:{' '}
                    <span className='font-mono'>{alert.transaction_id}</span>
                  </p>
                )}
              </div>

              <Separator />

              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>Kết quả từng luật</h4>
                {alert.results.map((result) => (
                  <RuleEvidence key={result.rule_id} result={result} />
                ))}
              </div>

              <Separator />

              <div className='space-y-2'>
                <Label htmlFor='review-reason'>Lý do quyết định</Label>
                <Textarea
                  id='review-reason'
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={MAX_REASON}
                  rows={4}
                  placeholder='Ghi rõ căn cứ dựa trên bằng chứng ở trên.'
                  disabled={alert.status !== 'open'}
                />
                <p className='text-muted-foreground text-xs'>
                  {alert.status === 'open'
                    ? `Bắt buộc ${MIN_REASON}–${MAX_REASON} ký tự. Đã nhập ${reason.trim().length}.`
                    : 'Cảnh báo đã được xử lý, chỉ xem lại bằng chứng.'}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Máy chủ kiểm tra lại quyền, số dư và trạng thái tài khoản tại
                  lúc ghi sổ, và từ chối nếu người quyết định chính là người tạo
                  lệnh.
                </p>
              </div>
            </div>

            <SheetFooter className='flex-row gap-2'>
              <Button
                variant='destructive'
                disabled={!canDecide}
                onClick={() => decide('reject')}
              >
                Từ chối
              </Button>
              <Button disabled={!canDecide} onClick={() => decide('approve')}>
                {review.isPending ? 'Đang gửi...' : 'Duyệt và ghi sổ'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
