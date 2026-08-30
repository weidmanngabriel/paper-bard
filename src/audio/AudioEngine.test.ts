import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioItem } from '../domain/types'
import { AudioEngine } from './AudioEngine'

const createdAudio: FakeAudio[] = []

class FakeAudio {
  src = ''
  preload = ''
  loop = false
  volume = 1
  paused = true
  ended = false
  currentTime = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(src = '') { this.src = src; createdAudio.push(this) }
  play = vi.fn(async () => { this.paused = false })
  pause = vi.fn(() => { this.paused = true })
  load = vi.fn()
  removeAttribute = vi.fn(() => { this.src = '' })
}

const track: AudioItem = {
  id: 'track-1', name: 'Dungeon', type: 'music', audioBlob: new Blob(['x']), mimeType: 'audio/mpeg',
  durationMs: 1000, sizeBytes: 1, volume: 0.8, loop: true, tags: [], createdAt: '2026-01-01T00:00:00.000Z', source: 'imported',
}
const effect: AudioItem = { ...track, id: 'effect-1', name: 'Door', type: 'soundEffect', loop: false }

beforeEach(() => {
  createdAudio.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(performance.now() + 1000); return 1 })
})

describe('AudioEngine', () => {
  it('verwaltet Play, Pause, Resume und Stop eines Tracks', async () => {
    const engine = new AudioEngine()
    engine.setDefaults(0.5, 0)
    await engine.play(track)
    expect(engine.getSnapshot().instances).toMatchObject([{ audioItemId: 'track-1', state: 'playing', loop: true }])
    engine.pauseItem(track.id)
    expect(engine.getSnapshot().instances[0].state).toBe('paused')
    await engine.resumeItem(track.id)
    expect(engine.getSnapshot().instances[0].state).toBe('playing')
    await engine.stopItem(track.id)
    expect(engine.getSnapshot().instances).toHaveLength(0)
    engine.destroy()
  })

  it('skaliert die Master-Lautstärke hörbar stärker als linear', async () => {
    const engine = new AudioEngine()
    engine.setDefaults(1, 0)
    await engine.play(track)
    expect(createdAudio[0].volume).toBeCloseTo(0.8)
    engine.setMasterVolume(0.5)
    expect(createdAudio[0].volume).toBeCloseTo(0.2)
    expect(engine.getSnapshot().masterVolume).toBe(0.5)
    engine.destroy()
  })

  it('erzeugt mehrere parallele Effektinstanzen im nativen Fallback', async () => {
    const engine = new AudioEngine()
    engine.setDefaults(1, 0)
    await engine.play(effect)
    await engine.play(effect)
    expect(engine.getSnapshot().instances.filter((instance) => instance.audioItemId === effect.id)).toHaveLength(2)
    await engine.stopItem(effect.id)
    expect(engine.getSnapshot().instances).toHaveLength(0)
    engine.destroy()
  })
})
