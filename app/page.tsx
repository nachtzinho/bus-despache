import { getLogs } from '@/app/actions/logs'
import { DispatcherDashboard } from '@/components/dispatcher/dashboard'

export default async function HomePage() {
  const logs = await getLogs()
  return <DispatcherDashboard initialLogs={logs} userName="Despachante" />
}
