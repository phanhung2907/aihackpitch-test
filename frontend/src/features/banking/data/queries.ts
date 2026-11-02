import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentCsrfToken } from '@/stores/auth-store'
import { apiGet, apiSend, newIdempotencyKey } from '@/lib/api'
import {
  type Account,
  type Customer,
  type Dashboard,
  type FraudAlert,
  type Transaction,
} from './types'

// Read hooks. Each one maps to a single operation in contracts/openapi.yaml and
// returns only the `data` array or object; pagination cursors are not used yet,
// so these show the first page the API returns.

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async ({ signal }) =>
      (await apiGet<Dashboard>('/dashboard', signal)).data,
  })
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async ({ signal }) =>
      (await apiGet<Customer[]>('/customers', signal)).data,
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async ({ signal }) =>
      (await apiGet<Account[]>('/accounts', signal)).data,
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async ({ signal }) =>
      (await apiGet<Transaction[]>('/transactions', signal)).data,
  })
}

export function useFraudAlerts() {
  return useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: async ({ signal }) =>
      (await apiGet<FraudAlert[]>('/fraud-alerts', signal)).data,
  })
}

// Write hooks. Money commands carry an Idempotency-Key generated once per
// command: a retry of the same command must reuse its key, so the key is part
// of the variables the caller passes in, not generated per attempt.

export type CashCommand = {
  account_id: string
  amount: string
  idempotencyKey: string
}

export type TransferCommand = {
  source_account_id: string
  destination_account_id: string
  amount: string
  location: { latitude: number; longitude: number } | null
  idempotencyKey: string
}

function useMoneyInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    // A posted or held command changes balances, reservations and the alert
    // queue, so refetch all of them rather than patching caches by hand.
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCreateCashCommand(kind: 'deposits' | 'withdrawals') {
  const invalidate = useMoneyInvalidation()
  return useMutation({
    mutationFn: async ({ idempotencyKey, ...body }: CashCommand) =>
      (
        await apiSend<Transaction>('POST', `/${kind}`, {
          body,
          csrfToken: currentCsrfToken(),
          idempotencyKey,
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useCreateTransfer() {
  const invalidate = useMoneyInvalidation()
  return useMutation({
    mutationFn: async ({ idempotencyKey, ...body }: TransferCommand) =>
      (
        await apiSend<Transaction>('POST', '/transfers', {
          body,
          csrfToken: currentCsrfToken(),
          idempotencyKey,
        })
      ).data,
    onSuccess: invalidate,
  })
}

export function useReviewTransaction() {
  const invalidate = useMoneyInvalidation()
  return useMutation({
    mutationFn: async (variables: {
      transactionId: string
      decision: 'approve' | 'reject'
      reason: string
      idempotencyKey: string
    }) =>
      (
        await apiSend<Transaction>(
          'POST',
          `/transactions/${variables.transactionId}/review-decisions`,
          {
            body: { decision: variables.decision, reason: variables.reason },
            csrfToken: currentCsrfToken(),
            idempotencyKey: variables.idempotencyKey,
          }
        )
      ).data,
    onSuccess: invalidate,
  })
}

export { newIdempotencyKey }
