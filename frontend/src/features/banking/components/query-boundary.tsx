import { type ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Vai trò hiện tại không được phép xem dữ liệu này.',
  AUTHENTICATION_REQUIRED: 'Phiên đăng nhập đã hết hạn, đăng nhập lại.',
  RECONCILIATION_FAILED:
    'Máy chủ phát hiện số dư và sổ cái lệch nhau nên từ chối phục vụ.',
}

type QueryBoundaryProps = {
  isPending: boolean
  error: unknown
  children: ReactNode
}

/** Loading and error handling shared by every banking screen. */
export function QueryBoundary({
  isPending,
  error,
  children,
}: QueryBoundaryProps) {
  if (error) {
    const apiError = error instanceof ApiError ? error : null
    return (
      <Alert variant='destructive'>
        <AlertTitle>
          {apiError ? `Lỗi ${apiError.status} · ${apiError.code}` : 'Lỗi mạng'}
        </AlertTitle>
        <AlertDescription>
          {apiError
            ? (MESSAGES[apiError.code] ?? apiError.message)
            : 'Không gọi được API. Kiểm tra backend đang chạy ở cổng 8000.'}
        </AlertDescription>
      </Alert>
    )
  }

  if (isPending) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  return <>{children}</>
}
