import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { SignOutDialog } from '@/components/sign-out-dialog'
export function ProfileDropdown(){const user=useAuthStore(s=>s.auth.user);const [open,setOpen]=useState(false);return <><span className='text-xs text-muted-foreground'>{user?.email} · {user?.role[0]}</span><Button size='sm' variant='outline' onClick={()=>setOpen(true)}>Đăng xuất</Button><SignOutDialog open={open} onOpenChange={setOpen}/></>}
