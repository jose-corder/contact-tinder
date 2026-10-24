import { PASS_ORDER } from '@/domain/taxonomy'
import { markCoachSeen } from '@/hooks/useCoach'

export function dismissDeckCoaches() { PASS_ORDER.forEach(markCoachSeen) }
