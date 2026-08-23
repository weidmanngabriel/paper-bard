import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioItem } from '../domain/types'
import { createItemArchive } from '../storage/backup'
import { LibraryView } from './LibraryView'

const app = vi.hoisted(() => ({
  items: [] as AudioItem[],
  addItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  setMessage: vi.fn(),
}))

vi.mock('../app/AppContext', () => ({
  useApp: () => app,
}))

const item: AudioItem = {
  id: 'forest-1',
  name: 'Wald / Nacht',
  type: 'ambience',
  audioBlob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }),
  mimeType: 'audio/mpeg',
  originalFileName: 'forest.mp3',
  durationMs: 12_000,
  sizeBytes: 4,
  volume: 0.7,
  loop: true,
  tags: ['forest'],
  createdAt: '2026-01-01T00:00:00.000Z',
  source: 'imported',
}

beforeEach(() => {
  app.items = [item]
  app.addItem.mockReset().mockResolvedValue(undefined)
  app.updateItem.mockReset().mockResolvedValue(undefined)
  app.removeItem.mockReset().mockResolvedValue(undefined)
  app.setMessage.mockReset()
})

describe('LibraryView', () => {
  it('bietet Downloads als Audio und Paper-Bard-Datei', async () => {
    const downloads: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloads.push(this.download)
    })
    render(<LibraryView />)

    const menu = screen.getByLabelText('Menü').closest('details')!
    menu.open = true
    fireEvent.click(within(menu).getByRole('button', { name: 'Audiodatei laden' }))
    fireEvent.click(within(menu).getByRole('button', { name: 'Als Paper Bard Datei laden' }))

    await waitFor(() => expect(downloads).toEqual(['Wald - Nacht.mp3', 'Wald - Nacht.paper-bard']))
    click.mockRestore()
  })

  it('importiert Paper-Bard-Dateien als Kopie mit neuer ID', async () => {
    const archive = Object.assign(await createItemArchive(item), { name: 'wald.paper-bard' }) as File
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('forest-copy')
    const { container } = render(<LibraryView />)
    const input = container.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [archive] } })

    await waitFor(() => expect(app.addItem).toHaveBeenCalledTimes(1))
    expect(app.addItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'forest-copy', name: item.name, tags: item.tags }))
  })

  it('speichert keine ungültige Paper-Bard-Datei', async () => {
    const invalidArchive = Object.assign(new Blob([zipSync({
      'manifest.json': strToU8(JSON.stringify({ schemaVersion: 1, kind: 'audio-item', item: {} })),
    })]), { name: 'defekt.paper-bard' }) as File
    const { container } = render(<LibraryView />)
    const input = container.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [invalidArchive] } })

    await waitFor(() => expect(app.setMessage).toHaveBeenCalledWith(expect.stringContaining('defekt.paper-bard')))
    expect(app.addItem).not.toHaveBeenCalled()
  })
})
