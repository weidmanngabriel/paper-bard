import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioItem } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { createBackup } from '../storage/backup'
import { SettingsView } from './SettingsView'

const app = vi.hoisted(() => ({
  items: [] as AudioItem[],
  settings: { masterVolume: 0.85, fadeDurationMs: 350 },
  updateSettings: vi.fn(),
  removeAll: vi.fn(),
  restore: vi.fn(),
  setMessage: vi.fn(),
}))

vi.mock('../app/AppContext', () => ({
  useApp: () => app,
}))

const item: AudioItem = {
  id: 'forest-1', name: 'Wald', type: 'ambience', audioBlob: new Blob(['audio'], { type: 'audio/mpeg' }), mimeType: 'audio/mpeg',
  durationMs: 1000, sizeBytes: 5, volume: 0.7, loop: true, tags: ['forest'], createdAt: '2026-01-01T00:00:00.000Z', source: 'imported',
}

beforeEach(() => {
  app.items = [item]
  app.settings = { ...DEFAULT_SETTINGS }
  app.updateSettings.mockReset().mockResolvedValue(undefined)
  app.removeAll.mockReset().mockResolvedValue(undefined)
  app.restore.mockReset().mockResolvedValue(undefined)
  app.setMessage.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('SettingsView', () => {
  it('exportiert vollständige Backups mit der Endung .paperbard', async () => {
    const downloads: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloads.push(this.download)
    })
    render(<SettingsView />)

    fireEvent.click(screen.getByRole('button', { name: /Daten exportieren/ }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]).toMatch(/^paper-bard-backup-\d{4}-\d{2}-\d{2}\.paperbard$/)
    click.mockRestore()
  })

  it('akzeptiert und importiert vollständige .paperbard-Backups', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const archive = Object.assign(await createBackup([item], DEFAULT_SETTINGS), { name: 'backup.paperbard' }) as File
    const { container } = render(<SettingsView />)
    const input = container.querySelector('input[type="file"]')!

    expect(input.getAttribute('accept')).toContain('.paperbard')
    fireEvent.change(input, { target: { files: [archive] } })

    await waitFor(() => expect(app.restore).toHaveBeenCalledWith(
      [expect.objectContaining({ id: item.id, name: item.name })],
      DEFAULT_SETTINGS,
    ))
    expect(screen.getByRole('button', { name: /\.paperbard importieren/ })).toBeVisible()
  })
})
