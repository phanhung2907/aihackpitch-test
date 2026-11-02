import { type Account, type Customer, type Transaction } from './types'

/**
 * Screens show account numbers and customer names, but the API returns ids.
 * These build lookups from whatever the current queries hold; an id with no
 * match is shown as a short prefix rather than hidden, so a missing row is
 * visible instead of silently blank.
 */
export function accountLabeller(accounts: Account[] | undefined) {
  const byId = new Map((accounts ?? []).map((item) => [item.id, item]))
  return (accountId: string | null): string => {
    if (!accountId) return '—'
    return byId.get(accountId)?.number ?? accountId.slice(0, 8)
  }
}

export function customerNamer(customers: Customer[] | undefined) {
  const byId = new Map((customers ?? []).map((item) => [item.id, item]))
  return (customerId: string): string =>
    byId.get(customerId)?.full_name ?? customerId.slice(0, 8)
}

export function transactionFinder(transactions: Transaction[] | undefined) {
  const byId = new Map((transactions ?? []).map((item) => [item.id, item]))
  return (id: string): Transaction | undefined => byId.get(id)
}
