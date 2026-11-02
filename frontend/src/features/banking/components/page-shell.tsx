import { useLocation } from '@tanstack/react-router'
import { useBankingData } from '@/features/banking/api/data'
import { type ReactNode } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

type PageShellProps = {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function PageShell({
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  const {role}=useBankingData()
  const location=useLocation()
  const restrictions:Record<string,string[]>={'customers':['teller'],'accounts':['customer','teller'],'transactions':['customer','teller','fraud_analyst'],'fraud-alerts':['fraud_analyst'],'users':['admin'],'operations':['admin','teller','fraud_analyst']}
  const required=restrictions[location.pathname.split('/')[1]]
  const permitted=!required||required.includes(role)

  return (
    <>
      <Header fixed>
        <span className='me-auto text-sm text-muted-foreground'>Ngân hàng · kết nối API trực tiếp</span>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
            <p className='text-muted-foreground'>{description}</p>
          </div>
          {permitted&&actions}
        </div>
        {permitted?children:<p role='alert'>Vai trò hiện tại không có quyền sử dụng chức năng này.</p>}
      </Main>
    </>
  )
}
