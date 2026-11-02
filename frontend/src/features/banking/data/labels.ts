import {
  type Account,
  type Customer,
  type FraudAlert,
  type RuleId,
  type RuleResult,
  type Transaction,
} from './types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export const transactionTypeLabels: Record<Transaction['type'], string> = {
  deposit: 'Gửi tiền',
  withdrawal: 'Rút tiền',
  transfer: 'Chuyển nội bộ',
}

export const transactionStatusLabels: Record<Transaction['status'], string> = {
  pending_review: 'Chờ duyệt',
  posted: 'Đã ghi sổ',
  rejected: 'Từ chối',
  reversed: 'Đã đảo',
}

export const transactionStatusVariants: Record<
  Transaction['status'],
  BadgeVariant
> = {
  pending_review: 'default',
  posted: 'secondary',
  rejected: 'destructive',
  reversed: 'outline',
}

export const accountStatusLabels: Record<Account['status'], string> = {
  active: 'Hoạt động',
  frozen: 'Đã khóa',
  closed: 'Đã đóng',
}

export const accountStatusVariants: Record<Account['status'], BadgeVariant> = {
  active: 'secondary',
  frozen: 'default',
  closed: 'outline',
}

export const customerStatusLabels: Record<Customer['status'], string> = {
  active: 'Hoạt động',
  archived: 'Lưu trữ',
}

export const alertStatusLabels: Record<FraudAlert['status'], string> = {
  open: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
}

export const alertStatusVariants: Record<FraudAlert['status'], BadgeVariant> = {
  open: 'default',
  approved: 'secondary',
  rejected: 'destructive',
}

export const ruleLabels: Record<RuleId, string> = {
  HIGH_AMOUNT: 'Số tiền lớn',
  DISTANT_LOCATIONS: 'Vị trí cách xa',
  RAPID_LARGE_TRANSACTIONS: 'Giao dịch lớn liên tiếp',
  LOCATION_UNAVAILABLE: 'Thiếu vị trí',
}

export const ruleDescriptions: Record<RuleId, string> = {
  HIGH_AMOUNT: 'Số tiền vượt 1.000.000.000 ₫.',
  DISTANT_LOCATIONS:
    'Hai giao dịch liên tiếp cùng tài khoản cách nhau quá 500 km.',
  RAPID_LARGE_TRANSACTIONS:
    'Có giao dịch trước trên 500.000.000 ₫ và lệnh hiện tại trên 500.000.000 ₫ trong vòng 30 giây.',
  LOCATION_UNAVAILABLE:
    'Không có tọa độ để đánh giá luật khoảng cách, nên lệnh bị giữ thay vì coi như đã đạt.',
}

export const ruleResultLabels: Record<RuleResult['result'], string> = {
  matched: 'Khớp',
  clear: 'Không khớp',
  unavailable: 'Không đánh giá được',
  skipped: 'Bỏ qua',
}

export const ruleResultVariants: Record<RuleResult['result'], BadgeVariant> = {
  matched: 'destructive',
  clear: 'secondary',
  unavailable: 'default',
  skipped: 'outline',
}

export const locationSourceLabels: Record<RuleResult['location_source'], string> =
  {
    branch: 'Tọa độ chi nhánh (server tra cứu)',
    demo_client: 'Vị trí mô phỏng từ trình duyệt (chưa xác minh)',
    unavailable: 'Không có vị trí',
  }
