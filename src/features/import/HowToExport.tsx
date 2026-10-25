import { useId, useState } from 'react'
import { Segmented } from '@/ui'

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
  const id = useId()
  return <>
    <section className="mt-8 border-y border-rule">
      <h2 className="py-4 font-serif t-heading">How to export your contacts</h2>
      <div aria-label="Contact export instructions" role="group">
        <Segmented value={String(active)} onChange={(value) => setActive(Number(value))} className="justify-between gap-2"
          options={sources.map((source, index) => ({ value: String(index), label: source.name, panelId: `${id}-${index}` }))} />
      </div>
      <div role="tabpanel" id={`${id}-${active}`} aria-labelledby={`${id}-${active}-tab`}>
        <ol className="divide-y divide-rule">
          {sources[active].steps.map((step, index) => <li key={step} className="flex gap-4 py-4">
            <span className="font-serif t-heading text-ink-2" aria-hidden="true">0{index + 1}</span>
            <p className="t-body leading-relaxed">{step}</p>
          </li>)}
        </ol>
        <a className="inline-flex min-h-11 items-center t-meta text-ink-2 underline underline-offset-4" href={sources[active].link} target="_blank" rel="noreferrer">Official instructions</a>
      </div>
      <p className="border-t border-rule py-4 t-meta leading-relaxed text-ink-2">On iPhone, look in the Files app under Browse → Downloads or iCloud Drive. Save the file there before choosing it here.</p>
    </section>
    <details className="mt-4 t-meta text-ink-2">
      <summary className="min-h-11 cursor-pointer py-3">Why a file?</summary>
      <p className="pb-3 leading-relaxed">Browsers cannot read your address book directly. Some Android browsers offer a Contact Picker, but iPhone Safari does not. A file lets you choose what to bring in; everything is processed on this device.</p>
    </details>
  </>
}
