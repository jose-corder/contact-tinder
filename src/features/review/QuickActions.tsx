import { Button, LabelDot, Sheet, InlineNotice, IconButton } from '@/ui'
import type { Bucket } from '@/domain/types'
import { BUCKET_META } from '@/domain/taxonomy'

export type Destination = Bucket | 'unsorted'
export const destinationLabel = (value: Destination) => value === 'unsorted' ? 'Unsort' : BUCKET_META[value].label
export function destinationsFor(bucket?: Bucket): Destination[] {
  return (['work', 'personal', 'delete', 'unsorted'] as Destination[]).filter(value => value !== (bucket ?? 'unsorted'))
}
interface Props {
  name: string; bucket?: Bucket; busy: boolean; onMove: (value: Destination) => void
}
export function RevealedActions({ name, bucket, busy, onMove }: Props) {
  return <>{destinationsFor(bucket).map(value => <IconButton key={value} size={44} style={{ width: 72 }}
    label={value === 'unsorted' ? 'Unsort ' + name : 'Move ' + name + ' to ' + destinationLabel(value)}
    disabled={busy} onClick={() => onMove(value)}>
    <LabelDot tone={value === 'unsorted' ? 'skip' : value} label={destinationLabel(value)} size={8} />
  </IconButton>)}</>
}
export default function QuickActions({ name, bucket, busy, onMove, open, onClose, error }: Props & {
  open: boolean; onClose: () => void; error: string
}) {
  return <Sheet open={open} onClose={onClose} title={'Move ' + name}
    footer={<Button full variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>}>
    <div className="space-y-2">{destinationsFor(bucket).map(value => <Button full variant="outline" key={value}
      disabled={busy} onClick={() => onMove(value)}>
      <LabelDot tone={value === 'unsorted' ? 'skip' : value} label={value === 'unsorted' ? 'Unsort' : 'Move to ' + destinationLabel(value)} size={8} />
    </Button>)}</div>
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
  </Sheet>
}
