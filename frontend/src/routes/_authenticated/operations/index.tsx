import { createFileRoute } from '@tanstack/react-router'
import { Operations } from '@/features/banking/operations'
export const Route = createFileRoute('/_authenticated/operations/')({component: Operations})
