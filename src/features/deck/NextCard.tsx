import { motion } from 'framer-motion'
import type { Contact } from '@/domain/types'
import { prefersReducedMotion } from '@/ui/theme'
import { SwipeCard } from './SwipeCard'

export function NextCard({ contact, advancing }: { contact: Contact; advancing: boolean }) {
  return <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" initial={false}
    animate={{ scale: advancing ? 1 : 0.94, opacity: advancing ? 1 : 0.6 }}
    transition={prefersReducedMotion() ? { duration: 0.12 } : { type: 'spring', stiffness: 300, damping: 30 }}>
    <SwipeCard contact={contact} preview />
  </motion.div>
}
