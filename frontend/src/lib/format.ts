const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dateOnly = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// Money arrives from the API as a digit string and stays one: BigInt keeps
// amounts above Number.MAX_SAFE_INTEGER exact, which plain numbers would not.
export function formatVnd(amount: string): string {
  return vnd.format(BigInt(amount))
}

export function formatVndCompact(amount: string): string {
  return new Intl.NumberFormat('vi-VN').format(BigInt(amount))
}

/** API timestamps are UTC; screens read Asia/Ho_Chi_Minh. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso))
}

export function formatRelativeAge(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

export function sumVnd(amounts: string[]): string {
  return amounts.reduce((total, value) => total + BigInt(value), 0n).toString()
}
