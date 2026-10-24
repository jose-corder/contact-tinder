# Contacts.

A private, mobile-first address-book sorter. Swipe contacts into Delete, Work or Personal, refine the labels, and export the results. [Open Contacts.](https://jose-corder.github.io/contact-tinder/)

## Privacy

Contacts and decisions stay in this browser's IndexedDB. Files are parsed locally; there is no contact-upload service or account. Fonts and app assets are served with the app and cached for offline use. Opening the site still requests static files from GitHub Pages. Export a JSON backup before clearing browser data, changing devices, or resetting the app.

## Bring your contacts

- **iPhone:** Open Contacts → Lists, touch and hold a list, choose Export, select the fields, then save the vCard to Files. [Apple instructions](https://support.apple.com/guide/iphone/export-contacts-iph075ddebf2/ios).
- **iCloud:** On a computer or tablet, open iCloud Contacts, select the contacts (or Select All Contacts), then use the share/export menu to export a vCard. [Apple instructions](https://support.apple.com/guide/icloud/import-export-and-print-contacts-mmfba748b2/icloud).
- **Google:** Open Google Contacts, select contacts, then More actions → Export. Save Google CSV or vCard. [Google instructions](https://support.google.com/contacts/answer/7199294?hl=en).
- **Outlook:** In Outlook on the web, open People → Manage contacts → Export contacts and save the CSV. In classic desktop Outlook, use File → Open & Export → Import/Export → Export to a file → Comma Separated Values, then select Contacts. [Microsoft instructions](https://support.microsoft.com/en-us/outlook/people/import-or-export-contacts-in-outlook-using-a-csv-file).

Choose the saved `.vcf` or `.csv` in Import. Keep the original export as a backup. Contacts marked Delete remain in your phone's address book until you act on the exported delete list yourself.

## Install and work offline

On iPhone, open the site in Safari and choose Share → Add to Home Screen. On supported desktop and Android browsers, use the browser's Install app command. The app confirms when its offline cache is ready. Open it online once before relying on offline access. New versions offer a **Reload** action so an update does not interrupt sorting. Theme choices also update the browser's toolbar color.

## Development

Use Node 22.22 or newer (CI uses the current Node 22 release).

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
node scripts/generate-icons.mjs
```

On Windows sandboxes that block Vitest's config bundling or worker spawn:

```sh
npx vitest run --configLoader native --pool threads
```

The icon script uses only Node built-ins and the existing 512 px artwork. It generates an opaque maskable icon with at least 20% padding on every side and a 180 px Apple touch icon. `import.meta.env.VITE_APP_VERSION` contains the package version plus the short Git SHA when Git is available.

## Deploy

`.github/workflows/deploy.yml` runs on pushes to `main` or manual dispatch. It caches npm, installs from the lockfile, runs lint, typecheck and tests, then builds with `GITHUB_PAGES=1`. Only a successful build uploads `dist` for the existing Pages deploy job.

GitHub Pages uses `/contact-tinder/`; other builds use `/`. Vite, the router, manifest, shortcuts and service-worker navigation fallback share that base. `scripts/postbuild.mjs` copies `index.html` to `404.html` for direct routes on Pages. The service worker serves the cached base-path index for offline routes. Configure the repository's Pages source as GitHub Actions. To verify a Pages build locally in PowerShell, set `$env:GITHUB_PAGES='1'` before `npm run build`.

## Architecture

- `src/domain/`: contact types, taxonomy and pure sorting/deck rules.
- `src/db/`: Dexie/IndexedDB persistence, queries, backup and restore.
- `src/features/`: home, import, swipe decks, review and export screens.
- `src/import/` and `src/export/`: parsing and portable file formats.
- `src/hooks/`: deck state, gestures and keyboard interactions.
- `src/ui/`: shared editorial primitives, inline SVGs, theme preferences and the module-level toast store.
- `src/App.tsx` and `src/main.tsx`: routing, reduced-motion-aware transitions and PWA lifecycle.
- `tests/`: domain, persistence, feature and shared UI behavior tests.

## Why no native address-book access

A browser app has no general permission to read or rewrite a device's entire address book. The Contact Picker API, where supported, grants access only to contacts the user selects and does not permit deleting or editing the originals. File import and export provide a portable, explicit workflow across iPhone, Android and desktop. Sorting here changes this app's local copy; applying the cleaned files or delete list to your address book remains your choice.
