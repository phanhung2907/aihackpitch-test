import {
  ArrowLeftRight,
  Bell,
  Bug,
  Command,
  Construction,
  FileX,
  LayoutDashboard,
  Lock,
  Monitor,
  Palette,
  ServerOff,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Phân tích viên demo',
    email: 'analyst@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'AI HackPitch Bank',
      logo: Command,
      plan: 'Bản demo nghiệp vụ',
    },
  ],
  navGroups: [
    {
      title: 'Nghiệp vụ',
      items: [
        {
          title: 'Tổng quan',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Khách hàng',
          url: '/customers',
          icon: Users,
        },
        {
          title: 'Tài khoản',
          url: '/accounts',
          icon: Wallet,
        },
        {
          title: 'Giao dịch',
          url: '/transactions',
          icon: ArrowLeftRight,
        },
        {
          title: 'Cảnh báo gian lận',
          url: '/fraud-alerts',
          icon: ShieldAlert,
        },
      ],
    },
    {
      title: 'Quản trị',
      items: [
        {
          title: 'Người dùng hệ thống',
          url: '/users',
          icon: UserCog,
        },
        {
          title: 'Đăng nhập',
          icon: ShieldCheck,
          items: [
            {
              title: 'Đăng nhập',
              url: '/sign-in',
            },
            {
              title: 'Đăng nhập (2 cột)',
              url: '/sign-in-2',
            },
            {
              title: 'Tạo tài khoản',
              url: '/sign-up',
            },
            {
              title: 'Quên mật khẩu',
              url: '/forgot-password',
            },
            {
              title: 'Mã OTP',
              url: '/otp',
            },
          ],
        },
        {
          title: 'Trang lỗi',
          icon: Bug,
          items: [
            {
              title: 'Chưa đăng nhập',
              url: '/errors/unauthorized',
              icon: Lock,
            },
            {
              title: 'Không có quyền',
              url: '/errors/forbidden',
              icon: UserX,
            },
            {
              title: 'Không tìm thấy',
              url: '/errors/not-found',
              icon: FileX,
            },
            {
              title: 'Lỗi máy chủ',
              url: '/errors/internal-server-error',
              icon: ServerOff,
            },
            {
              title: 'Đang bảo trì',
              url: '/errors/maintenance-error',
              icon: Construction,
            },
          ],
        },
      ],
    },
    {
      title: 'Khác',
      items: [
        {
          title: 'Cài đặt',
          icon: Settings,
          items: [
            {
              title: 'Hồ sơ',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Tài khoản',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Giao diện',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Thông báo',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Hiển thị',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
      ],
    },
  ],
}
