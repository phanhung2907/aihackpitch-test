import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SignOutDialog } from '@/components/sign-out-dialog'
export function NavUser({user}:{user:{name:string;email:string;avatar:string}}){const [open,setOpen]=useState(false);return <div className='grid gap-2 p-2'><p className='text-sm font-medium'>{user.name}</p><p className='text-xs text-muted-foreground'>{user.email}</p><Button variant='outline' onClick={()=>setOpen(true)}>Đăng xuất</Button><SignOutDialog open={open} onOpenChange={setOpen}/></div>}
