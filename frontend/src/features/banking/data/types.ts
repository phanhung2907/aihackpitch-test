// Mirrors contracts/openapi.yaml. Money fields are digit strings, never numbers.

export type Role = 'customer' | 'teller' | 'fraud_analyst' | 'admin'

export type RuleId =
  | 'HIGH_AMOUNT'
  | 'DISTANT_LOCATIONS'
  | 'RAPID_LARGE_TRANSACTIONS'
  | 'LOCATION_UNAVAILABLE'

export type Location = {
  latitude: number
  longitude: number
}

export type Customer = {
  id: string
  full_name: string
  email: string
  phone: string
  status: 'active' | 'archived'
  version: number
  created_at: string
}

export type Account = {
  id: string
  number: string
  customer_id: string
  currency: 'VND'
  label: string
  status: 'active' | 'frozen' | 'closed'
  posted_balance: string
  reserved_amount: string
  available_balance: string
  version: number
  created_at: string
}

export type Transaction = {
  id: string
  type: 'deposit' | 'withdrawal' | 'transfer'
  source_account_id: string | null
  destination_account_id: string | null
  amount: string
  currency: 'VND'
  status: 'pending_review' | 'posted' | 'rejected' | 'reversed'
  received_at: string
  created_at: string
  posted_at: string | null
  fraud_reason_codes: RuleId[]
  reversal_request_id: string | null
  version: number
}

export type RuleResult = {
  rule_id: RuleId
  result: 'matched' | 'clear' | 'unavailable' | 'skipped'
  threshold: string
  observed: string | null
  candidate_transaction_id: string | null
  candidate_received_at: string | null
  candidate_amount: string | null
  current_received_at: string
  current_amount: string
  location_source: 'branch' | 'demo_client' | 'unavailable'
  current_location: Location | null
  candidate_location: Location | null
}

export type FraudAlert = {
  id: string
  transaction_id: string
  status: 'open' | 'approved' | 'rejected'
  rule_version: number
  results: RuleResult[]
  created_at: string
  resolved_at: string | null
}

export type Dashboard = {
  role: Role
  as_of: string
  total_posted_balance: string | null
  total_reserved_amount: string | null
  posted_transaction_count: number
  open_alert_count: number | null
  oldest_pending_at: string | null
  managed_user_count: number | null
}

export type ReviewDecision = {
  decision: 'approve' | 'reject'
  reason: string
}
