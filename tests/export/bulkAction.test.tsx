// #25: Review can use the named generic component without format-specific props.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ExportAction } from '@/features/export/ExportAction'
import { dbRevision } from '@/export/json'
import { resetAll } from '@/db/repo'

beforeEach(resetAll)
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('prepares selected files as one ZIP and asks before downloading after share failure', async () => {
  const share = vi.fn().mockRejectedValue(new Error('Share unavailable'))
  vi.stubGlobal('navigator', { canShare: () => true, share })
  vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:zip'), revokeObjectURL: vi.fn() })
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const files = vi.fn().mockResolvedValue([new File(['one'], 'one.vcf'), new File(['two'], 'two.vcf')])
  render(<ExportAction files={files} label="selected contacts" revision={await dbRevision()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare selected contacts' }))
  const ready = await screen.findByRole('button', { name: 'Share ready file' })
  expect(screen.getByText('Ready to share.')).toBeVisible()
  expect(share).not.toHaveBeenCalled()
  fireEvent.click(ready)
  fireEvent.click(await screen.findByRole('button', { name: 'Download prepared file' }))
  await waitFor(() => expect(download).toHaveBeenCalledOnce())
  expect(files).toHaveBeenCalledOnce()
  expect(share.mock.calls[0][0].files).toHaveLength(1)
  expect(share.mock.calls[0][0].files[0].name).toBe('contacts-export.zip')
})
