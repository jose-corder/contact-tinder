import { memo } from 'react'
import { motion } from 'framer-motion'
import type { Contact } from '@/domain/types'
import { DECK_MOTION, useDeckReducedMotion } from './motion'
import { SwipeCard } from './SwipeCard'

export const NextCard = memo(function NextCard({ contact, advancing, stageHeight }: { contact: Contact; advancing: boolean; stageHeight?: number }) {
  const reduced = useDeckReducedMotion()
  return <motion.div key={reduced ? 'fade' : 'spring'} aria-hidden="true" className="pointer-events-none absolute inset-0" initial={false}
    style={{ transformOrigin: 'center bottom' }}
    animate={{ y: reduced || advancing ? 0 : 10, scale: reduced || advancing ? 1 : 0.94, opacity: advancing ? 1 : 0.6 }}
    transition={reduced ? DECK_MOTION.fade : DECK_MOTION.next}>
    <SwipeCard contact={contact} stageHeight={stageHeight} preview />
  </motion.div>
})
