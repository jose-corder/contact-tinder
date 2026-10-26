import { useConstrainedViewport, useMediaQuery } from '@/ui'

/** Leave text enlargement and software-keyboard layouts in the scrolling fallback. */
export function useLandscapeDeck() {
  const landscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)')
  const { keyboardOpen, largeText } = useConstrainedViewport()
  return landscape && !keyboardOpen && !largeText
}
