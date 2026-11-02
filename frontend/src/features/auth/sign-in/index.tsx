import { useSearch } from '@tanstack/react-router'
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'
export function SignIn() {
 const {redirect}=useSearch({from:'/(auth)/sign-in'})
 return <AuthLayout><Card className='w-full max-w-md'><CardHeader><CardTitle>Đăng nhập ngân hàng</CardTitle><CardDescription>Dữ liệu được lưu trong hệ thống. Dùng tài khoản demo được quản trị viên cấp.</CardDescription></CardHeader><CardContent><UserAuthForm redirectTo={redirect}/><p className='mt-5 text-xs text-muted-foreground'>Giao dịch viên: teller · Khách hàng: alice / bob · Kiểm duyệt: analyst · Quản trị: admin. Mật khẩu demo nằm trong file .env của máy chạy ứng dụng.</p></CardContent></Card></AuthLayout>
}
