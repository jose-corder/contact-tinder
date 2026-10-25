import { Button, InlineNotice, RecoveryBar } from '@/ui'
import { useMergeRecovery } from './useMergeRecovery'

/** #65: Settings and Review share the persisted authority and recovery presenter. */
export default function MergeRecovery() {
  const recovery = useMergeRecovery()
  return <div className="space-y-3">
    <RecoveryBar entries={recovery.entries} undoLabel="Undo merge" />
    {recovery.error && <InlineNotice tone="error">{recovery.error}
      <Button variant="ghost" onClick={recovery.retry}>Retry merge recovery</Button>
    </InlineNotice>}
  </div>
}
