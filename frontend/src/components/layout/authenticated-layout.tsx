import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { getSession } from '@/features/banking/api/client'
import { BankingContext, useBankingQuery } from '@/features/banking/api/data'
import { Button } from '@/components/ui/button'
import { Navigate, Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = useQuery({queryKey:['session'], queryFn:getSession, retry:false, staleTime:30000})
  const user = useAuthStore((s) => s.auth.user)
  const role = user?.role[0] ?? ''
  const banking = useBankingQuery(role)
  if (session.isPending) return <div className='p-8'>Đang khôi phục phiên đăng nhập...</div>
  if (session.isError || !user) return <Navigate to='/sign-in' search={{redirect:'/'}} />
  return <BankingContext.Provider value={banking.data ?? null}>
    {banking.isPending ? <div className='p-8'>Đang tải dữ liệu từ ngân hàng...</div> : banking.isError ? <div className='p-8 space-y-4'><p role='alert'>{banking.error.message}</p><Button onClick={() => banking.refetch()}>Thử tải lại</Button><Button variant='outline' onClick={() => { useAuthStore.getState().auth.reset(); window.location.href='/sign-in' }}>Về đăng nhập</Button></div> : <AuthenticatedFrame>{children}</AuthenticatedFrame>}
  </BankingContext.Provider>
}
function AuthenticatedFrame({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
