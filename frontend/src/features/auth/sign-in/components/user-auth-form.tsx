import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { ApiError, apiSend } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { PasswordInput } from '@/components/password-input'

// The API authenticates a `login` name, not an email address: the seeded demo
// users are admin, teller, analyst, alice and bob.
const formSchema = z.object({
  login: z.string().min(1, 'Nhập tên đăng nhập.'),
  password: z.string().min(1, 'Nhập mật khẩu.'),
})

type SessionResponse = {
  user: AuthUser
  csrf_token: string
  expires_at: string
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu.',
  LOGIN_THROTTLED: 'Đăng nhập sai quá nhiều lần, thử lại sau 15 phút.',
  ORIGIN_NOT_ALLOWED:
    'Origin của trang chưa nằm trong ALLOWED_ORIGINS của backend.',
}

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { login: '', password: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const { data } = await apiSend<SessionResponse>('POST', '/auth/login', {
        body: values,
      })
      auth.setSession(data)
      toast.success(`Đã đăng nhập: ${data.user.login} (${data.user.role})`)
      navigate({ to: redirectTo || '/', replace: true })
    } catch (error) {
      const message =
        error instanceof ApiError
          ? (ERROR_MESSAGES[error.code] ?? `${error.code}: ${error.message}`)
          : 'Không gọi được API. Kiểm tra backend đang chạy ở cổng 8000.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='login'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên đăng nhập</FormLabel>
              <FormControl>
                <Input placeholder='teller' autoComplete='username' {...field} />
              </FormControl>
              <FormDescription>
                User seed: admin, teller, analyst, alice, bob.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mật khẩu</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='********'
                  autoComplete='current-password'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Giá trị DEMO_PASSWORD trong .env ở repo root.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Đăng nhập
        </Button>
      </form>
    </Form>
  )
}
