import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { login } from '@/features/banking/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import { cn } from '@/lib/utils'
interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> { redirectTo?: string }
export function UserAuthForm({className,redirectTo,...props}:UserAuthFormProps) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const navigate=useNavigate(); const cache=useQueryClient()
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields=new FormData(event.currentTarget);setBusy(true);setError('')
    try { cache.clear(); await login(String(fields.get('login')),String(fields.get('password')));toast.success('Đã đăng nhập vào ngân hàng');await navigate({to:redirectTo?.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/',replace:true}) }
    catch(error){setError(error instanceof Error ? error.message : 'Không đăng nhập được')}
    finally{setBusy(false)}
  }
  return <form {...props} onSubmit={submit} className={cn('grid gap-4',className)}>
    <div className='grid gap-2'><Label htmlFor='bank-login'>Tên đăng nhập</Label><Input id='bank-login' name='login' autoComplete='username' required placeholder='teller / alice / analyst / admin' /></div>
    <div className='grid gap-2'><Label htmlFor='bank-password'>Mật khẩu</Label><PasswordInput id='bank-password' name='password' autoComplete='current-password' required /></div>
    {error && <p role='alert' className='text-sm text-destructive'>{error}</p>}
    <Button disabled={busy}>{busy?'Đang đăng nhập...':'Đăng nhập'}</Button>
  </form>
}
