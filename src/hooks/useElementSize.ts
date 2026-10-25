import { useLayoutEffect, useRef, useState } from 'react'

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const update = (width: number, height: number) => setSize((old) =>
      old.width === width && old.height === height ? old : { width, height })
    const rect = node.getBoundingClientRect()
    update(rect.width, rect.height)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height)
    })
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [])
  return { ref, ...size }
}
