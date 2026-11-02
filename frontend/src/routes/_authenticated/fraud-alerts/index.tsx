import { createFileRoute } from '@tanstack/react-router'
import { FraudAlerts } from '@/features/fraud-alerts'

export const Route = createFileRoute('/_authenticated/fraud-alerts/')({
  component: FraudAlerts,
})
