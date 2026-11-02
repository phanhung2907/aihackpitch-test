import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { formatVnd } from '@/lib/format'
import { toast } from 'sonner'
import { request, type Models } from '@/features/banking/api/client'
import { useBankingData } from '@/features/banking/api/data'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Amount mirrors the contract's Amount schema: a positive digit string with no
// separators, kept as a string so no money value ever passes through Number.
const amountSchema = z
  .string()
  .min(1, 'Nhập số tiền.')
  .regex(/^[1-9][0-9]*$/, 'Chỉ nhập chữ số, không dấu phân cách, phải lớn hơn 0.')
  .refine((value) => value.length <= 19, 'Số tiền vượt giới hạn lưu trữ.')

const formSchema = z
  .object({
    type: z.enum(['deposit', 'withdrawal', 'transfer']),
    source_account_id: z.string().optional(),
    destination_account_id: z.string().optional(),
    amount: amountSchema,
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'withdrawal' && !value.destination_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination_account_id'],
        message: 'Chọn tài khoản nhận.',
      })
    }
    if (value.type !== 'deposit' && !value.source_account_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['source_account_id'],
        message: 'Chọn tài khoản nguồn.',
      })
    }
    if (
      value.type === 'transfer' &&
      value.source_account_id &&
      value.source_account_id === value.destination_account_id
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination_account_id'],
        message: 'Không chuyển cho chính tài khoản nguồn.',
      })
    }
    const hasLatitude = Boolean(value.latitude)
    const hasLongitude = Boolean(value.longitude)
    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Nhập cả vĩ độ và kinh độ, hoặc bỏ trống cả hai.',
      })
    }
  })

type FormValues = z.infer<typeof formSchema>


export function NewTransactionDialog() {
  const {accounts,role,refresh}=useBankingData()
  const openAccounts=accounts.filter(a=>a.status==='active')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const attempts=useRef(new Map<string,string>())
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: role==='customer'?'transfer':'deposit',
      source_account_id: '',
      destination_account_id: '',
      amount: '',
      latitude: '',
      longitude: '',
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const type = form.watch('type')
  const amount = form.watch('amount')

  async function onSubmit(values: FormValues) {
    if(busy)return
    setBusy(true);setError('')
    try {
    if(values.type==='transfer') { const recipient=await request<Models['Recipient']>('/accounts/recipient-lookup?account_number='+encodeURIComponent(values.destination_account_id??'')); values={...values,destination_account_id:recipient.account_id} }
    // The backend owns the fraud decision, the ledger and the balances; this
    // screen only shows what the request body would be.
    const payload =
      values.type === 'transfer'
        ? {
            source_account_id: values.source_account_id,
            destination_account_id: values.destination_account_id,
            amount: values.amount,
            location: values.latitude
              ? {
                  latitude: Number(values.latitude),
                  longitude: Number(values.longitude),
                }
              : null,
          }
        : {
            account_id:
              values.type === 'deposit'
                ? values.destination_account_id
                : values.source_account_id,
            amount: values.amount,
          }

    const path=values.type==='deposit'?'/deposits':values.type==='withdrawal'?'/withdrawals':'/transfers'
    const fingerprint=path+JSON.stringify(payload);const key=attempts.current.get(fingerprint)??crypto.randomUUID();attempts.current.set(fingerprint,key)
    const result=await request<Models['Transaction']>(path,'POST',payload,key)
    attempts.current.delete(fingerprint);await refresh();toast.success(result.status==='posted'?'Đã ghi sổ giao dịch':'Giao dịch đang chờ kiểm duyệt, chưa ghi sổ')
    setOpen(false)
    form.reset()
    }catch(e){setError(e instanceof Error?e.message:'Không tạo được lệnh')}finally{setBusy(false)}
  }
  if(!['teller','customer'].includes(role))return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tạo lệnh</Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Tạo lệnh tiền</DialogTitle>
          <DialogDescription>
            Số tiền nhập theo đồng nguyên, không dấu phân cách. Kết quả gian lận
            do máy chủ quyết định sau khi nhận lệnh.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id='new-transaction-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại lệnh</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {role==='teller'&&<SelectItem value='deposit'>Gửi tiền</SelectItem>}
                      {role==='teller'&&<SelectItem value='withdrawal'>Rút tiền</SelectItem>}
                      {role==='customer'&&<SelectItem value='transfer'>Chuyển nội bộ</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {type !== 'deposit' && (
              <FormField
                control={form.control}
                name='source_account_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tài khoản nguồn</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Chọn tài khoản' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {openAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.number} — khả dụng{' '}
                            {formatVnd(account.available_balance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {type !== 'withdrawal' && (
              <FormField
                control={form.control}
                name='destination_account_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tài khoản nhận</FormLabel>
                    {type==='transfer'?<Input placeholder='Số tài khoản người nhận' {...field} />:(<>                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Chọn tài khoản' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {openAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
</>)}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VND)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode='numeric'
                      autoComplete='off'
                      placeholder='1000000'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {/^[1-9][0-9]*$/.test(amount)
                      ? formatVnd(amount)
                      : 'Chỉ chữ số, không dấu chấm hay phẩy.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {type === 'transfer' && (
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='latitude'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vĩ độ</FormLabel>
                      <FormControl>
                        <Input placeholder='21.0285' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='longitude'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kinh độ</FormLabel>
                      <FormControl>
                        <Input placeholder='105.8542' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className='text-muted-foreground col-span-2 text-xs'>
                  Vị trí chuyển khoản là dữ liệu mô phỏng từ trình duyệt và hiển
                  thị là chưa xác minh. Bỏ trống thì lệnh sẽ bị giữ với lý do
                  LOCATION_UNAVAILABLE.
                </p>
              </div>
            )}
          </form>
        </Form>

        {error&&<p role='alert' className='text-destructive text-sm'>{error}</p>}
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              setOpen(false)
              form.reset()
            }}
          >
            Hủy
          </Button>
          <Button type='submit' disabled={busy} form='new-transaction-form'>
            Gửi lệnh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
