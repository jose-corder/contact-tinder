// Generates public/demo.vcf with 40 fake contacts (vCard 3.0) including a couple of duplicates.
import { writeFileSync } from 'node:fs'

const first = ['Maria', 'Daniel', 'Sofia', 'Lucas', 'Elena', 'Mateo', 'Camila', 'Andres', 'Valentina', 'Javier', 'Isabela', 'Tomas', 'Lucia', 'Sebastian', 'Paula', 'Nicolas', 'Carolina', 'Diego', 'Gabriela', 'Martin']
const last = ['Gomez', 'Rivera', 'Castro', 'Ortiz', 'Morales', 'Vargas', 'Reyes', 'Flores', 'Torres', 'Navarro', 'Mendoza', 'Herrera', 'Silva', 'Romero', 'Pena', 'Cruz', 'Ramos', 'Jimenez', 'Delgado', 'Suarez']
const orgs = [['Acme Corp', 'CFO'], ['Northwind', 'Head of Sales'], ['Globex', 'Procurement Lead'], ['Initech', 'Engineer'], ['Umbrella Studio', 'Creative Director'], ['Vandelay Imports', 'Account Manager'], ['Stark Legal', 'Partner'], ['Wayne Capital', 'Analyst'], ['', ''], ['', ''], ['', '']]
const notes = ['Met at the Lisbon conference 2022', 'Padel on Thursdays', 'Introduced by Ana', 'Sent proposal Q3', '', '', '', 'Dentist', 'Plumber, good rates', 'Cousin from Madrid']

let seed = 7
const rnd = (n) => { seed = (seed * 9301 + 49297) % 233280; return Math.floor((seed / 233280) * n) }

const cards = []
for (let i = 0; i < 38; i++) {
  const f = first[rnd(first.length)], l = last[rnd(last.length)]
  const [org, title] = orgs[rnd(orgs.length)]
  const phone = `+1 555 ${String(100 + rnd(900))} ${String(1000 + rnd(9000))}`
  const email = rnd(4) === 0 ? '' : `${f}.${l}@${org ? org.toLowerCase().replace(/\s+/g, '') + '.com' : 'gmail.com'}`.toLowerCase()
  const note = notes[rnd(notes.length)]
  const year = 2015 + rnd(10)
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${l};${f};;;`, `FN:${f} ${l}`,
  ]
  if (org) lines.push(`ORG:${org}`, `TITLE:${title}`)
  lines.push(`TEL;TYPE=CELL:${phone}`)
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${email}`)
  if (note) lines.push(`NOTE:${note}`)
  lines.push(`REV:${year}-0${1 + rnd(9)}-1${rnd(9)}T10:00:00Z`, `UID:demo-${i}`, 'END:VCARD')
  cards.push(lines.join('\r\n'))
}
// two duplicates of card 0 with a different format phone and no UID
const dup = cards[0].replace(/UID:demo-0\r\n/, '').replace(/\+1 555 (\d{3}) (\d{4})/, '(555) $1-$2')
cards.push(dup, dup.replace('FN:', 'FN:').replace(/EMAIL;TYPE=INTERNET:[^\r]*\r\n/, ''))

writeFileSync(new URL('../public/demo.vcf', import.meta.url), cards.join('\r\n') + '\r\n')
console.log(`wrote ${cards.length} cards`)
