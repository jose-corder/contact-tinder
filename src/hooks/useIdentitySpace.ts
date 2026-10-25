import { useLayoutEffect, useState, type RefObject } from 'react'

/** Reserve complete essential rows before spending the remaining body height on identity. */
export function useIdentitySpace(body: RefObject<HTMLDivElement | null>, identity: RefObject<HTMLDivElement | null>,
  fields: RefObject<HTMLDListElement | null>, required: number, compact: boolean, landscape: boolean) {
  const [lines, setLines] = useState({ name: 2, role: 2 })
  useLayoutEffect(() => {
    const name = identity.current?.querySelector('h2')
    const role = identity.current?.querySelector('p')
    const avatar = identity.current?.querySelector('[data-identity-avatar]')
    const measure = () => {
      if (!body.current || !name || !role || !fields.current) return
      const height = body.current.getBoundingClientRect().height
      if (!height) return
      const nameLine = parseFloat(getComputedStyle(name).lineHeight) || 38
      const roleLine = parseFloat(getComputedStyle(role).lineHeight) || 22
      const fieldStyle = getComputedStyle(fields.current)
      const fixed = [...fields.current.children].slice(0, required)
        .reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) +
        (parseFloat(fieldStyle.marginTop) || 0) + (parseFloat(fieldStyle.paddingTop) || 0) +
        (parseFloat(fieldStyle.borderTopWidth) || 0)
      const avatarHeight = avatar?.getBoundingClientRect().height ?? 0
      const available = height - (landscape ? 0 : fixed) - (parseFloat(getComputedStyle(role).marginTop) || 0)
      const identityHeight = (nameLines: number, roleLines: number) =>
        (compact ? Math.max(avatarHeight, nameLines * nameLine) : avatarHeight + 12 + nameLines * nameLine) + roleLines * roleLine
      // Give the name its second line first, then the role/org.
      const next = identityHeight(2, 2) <= available ? { name: 2, role: 2 }
        : identityHeight(2, 1) <= available ? { name: 2, role: 1 } : { name: 1, role: 1 }
      setLines(old => old.name === next.name && old.role === next.role ? old : next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    for (const node of [body.current, identity.current, fields.current, name, role, avatar]) if (node) observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [body, identity, fields, required, compact, landscape])
  return lines
}
