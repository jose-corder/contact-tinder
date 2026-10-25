import { useState } from 'react'
import { cx } from '@/ui'

const sources = [
  { name: 'iPhone', steps: [
    'Open the Contacts app and tap Lists.',
    'Touch and hold All iCloud or the list you want, then tap Export.',
    'Choose the fields to include, tap Done, then Save to Files.',
    'Return here and choose the saved .vcf file.',
  ], link: 'https://support.apple.com/guide/iphone/iph075ddebf2/ios' },
  { name: 'iCloud.com', steps: [
    'On a tablet or computer, sign in at icloud.com/contacts.',
    'Open the actions menu above the list and choose Select All Contacts.',
    'Use the Share button, then Export vCard.',
    'Save the .vcf to a folder you can open from this device.',
  ], link: 'https://support.apple.com/guide/icloud/mmfba748b2/icloud' },
  { name: 'Google', steps: [
    'Open contacts.google.com and select the contacts you want.',
    'Choose Export, then vCard or Google CSV.',
    'Save the file, then return here to choose it.',
  ], link: 'https://support.google.com/contacts/answer/7199294' },
  { name: 'Outlook', steps: [
    'Open Outlook on the web and go to People.',
    'Choose Manage contacts, then Export contacts.',
    'Select all contacts or a folder, then Export.',
    'Choose the downloaded CSV file here.',
  ], link: 'https://support.microsoft.com/en-au/outlook/export-contacts-from-outlook-com-or-outlook-on-the-web' },
]

export default function HowToExport() {
  const [active, setActive] = useState(0)
  return <>
    <section className="mt-8 border-y border-rule">
      <h2 className="py-4 font-serif text-xl">How to export your contacts</h2>
      <div role="tablist" aria-label="Contact export instructions" className="flex justify-between border-b border-rule">
        {sources.map((source, index) => <button key={source.name} role="tab" id={`source-${index}`}
          aria-selected={active === index} aria-controls="export-steps" tabIndex={active === index ? 0 : -1}
          className={cx('min-h-11 border-b px-1 text-[13px]', active === index ? 'border-ink text-ink' : 'border-transparent text-ink-2')}
          onClick={() => setActive(index)} onKeyDown={(event) => {
            const next = event.key === 'ArrowRight' ? (active + 1) % 4 : event.key === 'ArrowLeft' ? (active + 3) % 4
              : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : undefined
            if (next !== undefined) { event.preventDefault(); setActive(next); document.getElementById(`source-${next}`)?.focus() }
          }}>{source.name}</button>)}
      </div>
      <div role="tabpanel" id="export-steps" aria-labelledby={`source-${active}`}>
        <ol className="divide-y divide-rule">
          {sources[active].steps.map((step, index) => <li key={step} className="flex gap-4 py-4">
            <span className="font-serif text-xl text-ink-2" aria-hidden="true">0{index + 1}</span>
            <p className="text-sm leading-relaxed">{step}</p>
          </li>)}
        </ol>
        <a className="inline-flex min-h-11 items-center text-xs text-ink-2 underline underline-offset-4" href={sources[active].link} target="_blank" rel="noreferrer">Official instructions</a>
      </div>
      <p className="border-t border-rule py-4 text-xs leading-relaxed text-ink-2">On iPhone, look in the Files app under Browse → Downloads or iCloud Drive. Save the file there before choosing it here.</p>
    </section>
    <details className="mt-4 text-xs text-ink-2">
      <summary className="min-h-11 cursor-pointer py-3">Why a file?</summary>
      <p className="pb-3 leading-relaxed">Browsers cannot read your address book directly. Some Android browsers offer a Contact Picker, but iPhone Safari does not. A file lets you choose what to bring in; everything is processed on this device.</p>
    </details>
  </>
}
