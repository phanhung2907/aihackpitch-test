import { useRef, useState } from 'react'
import { formatDateTime, formatVnd } from '@/lib/format'
import { toast } from 'sonner'
import { request } from '@/features/banking/api/client'
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
import { useBankingData } from '@/features/banking/api/data'
import {
  type FraudAlert,
  type RuleResult,
} from '@/features/banking/data/types'

const MIN_REASON = 10
const MAX_REASON = 1000

type AlertReviewSheetProps = {
  alert: FraudAlert | null
  onOpenChange: (open: boolean) => void
  onDecision: (alertId: string, decision: 'approve' | 'reject') => void
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
  onOpenChange,
  onDecision,
}: AlertReviewSheetProps) {
  const {accountLabel,transactionById,refresh}=useBankingData()
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const attempts=useRef(new Map<string,string>())
  const [reason, setReason] = useState('')
  const transaction = alert ? transactionById(alert.transaction_id) : undefined
  const reasonTooShort = reason.trim().length < MIN_REASON
  const canDecide = alert?.status === 'open' && !reasonTooShort && !busy

  async function decide(decision: 'approve' | 'reject') {
    if(!alert||!canDecide)return
    const body={decision,reason:reason.trim()};const fingerprint=alert.id+JSON.stringify(body);const key=attempts.current.get(fingerprint)??crypto.randomUUID();attempts.current.set(fingerprint,key)
    setBusy(true);setError('')
    try{await request('/transactions/'+alert.transaction_id+'/review-decisions','POST',body,key);attempts.current.delete(fingerprint);await refresh();onDecision(alert.id,decision);setReason('');onOpenChange(false);toast.success(decision==='approve'?'Đã duyệt và ghi sổ':'Đã từ chối và giải phóng tiền giữ chỗ')}
    catch(e){setError(e instanceof Error?e.message:'Không lưu được quyết định')}
    finally{setBusy(false)}
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
                    Không tải được giao dịch liên quan.
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
                  Người tạo lệnh không được tự duyệt lệnh của mình; máy chủ kiểm
                  tra lại quyền, số dư và trạng thái tài khoản tại lúc ghi sổ.
                </p>
              </div>
            </div>

            {error&&<p role='alert' className='px-4 text-sm text-destructive'>{error}</p>}
            <SheetFooter className='flex-row gap-2'>
              <Button
                variant='destructive'
                disabled={!canDecide}
                onClick={() => decide('reject')}
              >
                Từ chối
              </Button>
              <Button disabled={!canDecide} onClick={() => decide('approve')}>
                Duyệt và ghi sổ
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
