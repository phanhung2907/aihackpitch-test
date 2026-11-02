import { createContext, useContext } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { list, request, type Models } from './client'

export function useBankingQuery(role: string) {
  return useQuery({ queryKey: ['banking', role], enabled: Boolean(role), queryFn: async () => {
    const [dashboard, accounts, customers, transactions, fraudAlerts, users, branches, rules, reversals, audit] = await Promise.all([
      request<Models['Dashboard']>('/dashboard'),
      ['customer','teller'].includes(role) ? list<Models['Account']>('/accounts') : [],
      role === 'teller' ? list<Models['Customer']>('/customers') : [],
      ['customer','teller','fraud_analyst'].includes(role) ? list<Models['Transaction']>('/transactions') : [],
      role === 'fraud_analyst' ? list<Models['FraudAlert']>('/fraud-alerts') : [],
      role === 'admin' ? list<Models['User']>('/users') : [],
      role === 'admin' ? list<Models['Branch']>('/branches') : [],
      role === 'admin' ? list<Models['RuleVersion']>('/fraud-rule-versions') : [],
      ['teller','fraud_analyst'].includes(role) ? list<Models['ReversalRequest']>('/reversal-requests') : [],
      role === 'admin' ? list<Models['AuditLog']>('/audit-logs') : [],
    ])
    return { dashboard, accounts, customers, transactions, fraudAlerts, users, branches, rules, reversals, audit }
  }, staleTime: 5000, refetchInterval: 15000, retry: false })
}
export type BankingData = NonNullable<ReturnType<typeof useBankingQuery>['data']>
export const BankingContext = createContext<BankingData | null>(null)
export function useBankingData() {
  const data = useContext(BankingContext)
  const client = useQueryClient()
  const role = useAuthStore((s) => s.auth.user?.role[0] ?? '')
  if (!data) throw new Error('Banking data provider missing')
  return { ...data, role, refresh: () => client.invalidateQueries({queryKey:['banking']}), customerName: (id: string) => data.customers.find((c) => c.id === id)?.full_name ?? id, accountLabel: (id: string | null) => id ? data.accounts.find((a) => a.id === id)?.number ?? id : 'Tiền mặt', transactionById: (id: string) => data.transactions.find((t) => t.id === id) }
}
