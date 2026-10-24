const sources = [
  ['iPhone', 'Contacts app → Lists → long-press “All iCloud” or “All Contacts” → Export → save to Files, then pick it here.'],
  ['iCloud.com', 'Contacts → select all → gear → Export vCard.'],
  ['Google Contacts', 'Export → vCard or Google CSV.'],
  ['Outlook', 'People → Manage → Export contacts CSV.'],
]

export default function HowToExport() {
  return (
    <details className="mt-8 border-y border-rule font-sans">
      <summary className="cursor-pointer py-4 text-ink">How to export your contacts</summary>
      <ol className="pb-2">
        {sources.map(([name, instructions], index) => (
          <li key={name} className="hairline flex gap-4 py-4">
            <span className="font-serif text-xl text-ink-2" aria-hidden="true">0{index + 1}</span>
            <div>
              <h2 className="mb-1 font-medium text-ink">{name}</h2>
              <p className="text-sm leading-relaxed text-ink-2">{instructions}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
