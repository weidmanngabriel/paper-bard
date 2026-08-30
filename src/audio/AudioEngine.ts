import type { AudioItem, AudioSnapshot, PlaybackInstance } from '../domain/types'
import { clampVolume } from '../domain/types'

type Listener = () => void

interface ItemControl {
  volume: number
  muted: boolean
  loop: boolean
}

interface NativeRuntime {
  instance: PlaybackInstance
  item: AudioItem
  element: HTMLAudioElement
  url: string
}

interface WebRuntime {
  instance: PlaybackInstance
  item: AudioItem
  buffer: AudioBuffer
  source?: AudioBufferSourceNode
  gain: GainNode
  startedAt: number
  offset: number
  intentionalStop: boolean
}

const WEB_AUDIO_TIMEOUT_MS = 1200
const BUFFER_CACHE_LIMIT = 64 * 1024 * 1024

function masterGainFor(volume: number): number {
  const clamped = clampVolume(volume)
  return clamped * clamped
}

export class AudioEngine {
  private listeners = new Set<Listener>()
  private controls = new Map<string, ItemControl>()
  private nativeRuntimes = new Map<string, NativeRuntime>()
  private webRuntimes = new Map<string, WebRuntime>()
  private globallyPausedIds = new Set<string>()
  private context?: AudioContext
  private masterGain?: GainNode
  private bufferCache = new Map<string, { buffer: AudioBuffer; bytes: number; usedAt: number }>()
  private masterVolume = 0.85
  private fadeDurationMs = 350
  private globallyPaused = false
  private snapshot: AudioSnapshot = { instances: [], masterVolume: 0.85, globallyPaused: false }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.syncState)
      document.addEventListener('visibilitychange', this.syncState)
      this.configureMediaSession()
    }
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): AudioSnapshot => this.snapshot

  setDefaults(masterVolume: number, fadeDurationMs: number): void {
    this.masterVolume = clampVolume(masterVolume)
    this.fadeDurationMs = Math.max(0, Math.min(5000, fadeDurationMs))
    this.updateAllVolumes()
    this.emit()
  }

  async play(item: AudioItem): Promise<void> {
    await this.activate()
    if (item.type === 'soundEffect') {
      await this.playEffect(item)
    } else {
      await this.playTrack(item)
    }
  }

  async playTrack(item: AudioItem): Promise<void> {
    const existing = Array.from(this.nativeRuntimes.values()).find(
      (runtime) => runtime.item.id === item.id && runtime.instance.kind === 'track',
    )
    if (existing) {
      if (existing.instance.state === 'paused') {
        await existing.element.play()
        existing.instance.state = 'playing'
        this.emit()
      }
      return
    }

    const control = this.controlFor(item)
    const url = URL.createObjectURL(item.audioBlob)
    const element = new Audio(url)
    const id = crypto.randomUUID()
    const instance: PlaybackInstance = {
      id,
      audioItemId: item.id,
      state: 'playing',
      volume: control.volume,
      muted: control.muted,
      loop: control.loop,
      kind: 'track',
    }
    const runtime: NativeRuntime = { instance, item, element, url }
    element.preload = 'auto'
    element.loop = control.loop
    this.applyNativeVolume(runtime)
    element.onended = () => this.removeNative(id)
    element.onerror = () => this.removeNative(id)
    this.nativeRuntimes.set(id, runtime)
    try {
      await element.play()
      this.emit()
    } catch (error) {
      this.removeNative(id)
      throw new Error(error instanceof Error ? error.message : 'Der Track konnte nicht gestartet werden.')
    }
  }

  async playEffect(item: AudioItem): Promise<void> {
    try {
      const context = await this.ensureContext()
      const buffer = await this.bufferFor(item, context)
      this.startWebEffect(item, buffer)
    } catch {
      await this.startNativeEffect(item)
    }
  }

  pauseItem(audioItemId: string): void {
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'playing') this.pauseNative(runtime)
    }
    for (const runtime of this.webRuntimes.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'playing') this.pauseWeb(runtime)
    }
    this.emit()
  }

  async resumeItem(audioItemId: string): Promise<void> {
    await this.activate()
    const tasks: Promise<void>[] = []
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'paused') {
        tasks.push(runtime.element.play().then(() => { runtime.instance.state = 'playing' }))
      }
    }
    for (const runtime of this.webRuntimes.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'paused') this.startWebSource(runtime)
    }
    await Promise.all(tasks)
    this.emit()
  }

  async stopItem(audioItemId: string): Promise<void> {
    const native = Array.from(this.nativeRuntimes.values()).filter((runtime) => runtime.item.id === audioItemId)
    const web = Array.from(this.webRuntimes.values()).filter((runtime) => runtime.item.id === audioItemId)
    await Promise.all(native.map((runtime) => this.stopNative(runtime)))
    web.forEach((runtime) => this.stopWeb(runtime))
  }

  async stopAll(): Promise<void> {
    const native = Array.from(this.nativeRuntimes.values())
    const web = Array.from(this.webRuntimes.values())
    await Promise.all(native.map((runtime) => this.stopNative(runtime)))
    web.forEach((runtime) => this.stopWeb(runtime))
    this.globallyPausedIds.clear()
    this.globallyPaused = false
    this.emit()
  }

  pauseAll(): void {
    this.globallyPausedIds.clear()
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.instance.state === 'playing') {
        this.globallyPausedIds.add(runtime.instance.id)
        this.pauseNative(runtime)
      }
    }
    for (const runtime of this.webRuntimes.values()) {
      if (runtime.instance.state === 'playing') {
        this.globallyPausedIds.add(runtime.instance.id)
        this.pauseWeb(runtime)
      }
    }
    this.globallyPaused = this.globallyPausedIds.size > 0
    this.emit()
  }

  async resumeAll(): Promise<void> {
    await this.activate()
    const tasks: Promise<void>[] = []
    for (const id of this.globallyPausedIds) {
      const native = this.nativeRuntimes.get(id)
      if (native) tasks.push(native.element.play().then(() => { native.instance.state = 'playing' }))
      const web = this.webRuntimes.get(id)
      if (web) this.startWebSource(web)
    }
    await Promise.allSettled(tasks)
    this.globallyPausedIds.clear()
    this.globallyPaused = false
    this.emit()
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clampVolume(value)
    this.updateAllVolumes()
    this.emit()
  }

  setItemVolume(item: AudioItem, value: number): void {
    const control = this.controlFor(item)
    control.volume = clampVolume(value)
    this.updateItemControl(item.id, control)
  }

  setItemMuted(item: AudioItem, muted: boolean): void {
    const control = this.controlFor(item)
    control.muted = muted
    this.updateItemControl(item.id, control)
  }

  setItemLoop(item: AudioItem, loop: boolean): void {
    const control = this.controlFor(item)
    control.loop = loop
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.item.id === item.id) {
        runtime.instance.loop = loop
        runtime.element.loop = loop
      }
    }
    for (const runtime of this.webRuntimes.values()) {
      if (runtime.item.id === item.id) {
        runtime.instance.loop = loop
        if (runtime.source) runtime.source.loop = loop
      }
    }
    this.emit()
  }

  async activate(): Promise<void> {
    if (this.context?.state === 'suspended') {
      try {
        await this.withTimeout(this.context.resume())
      } catch {
        await this.rebuildContext()
      }
    }
  }

  destroy(): void {
    window.removeEventListener('pageshow', this.syncState)
    document.removeEventListener('visibilitychange', this.syncState)
    for (const runtime of this.nativeRuntimes.values()) this.removeNative(runtime.instance.id)
    for (const runtime of this.webRuntimes.values()) this.removeWeb(runtime.instance.id)
    void this.context?.close()
    this.listeners.clear()
  }

  private controlFor(item: AudioItem): ItemControl {
    let control = this.controls.get(item.id)
    if (!control) {
      control = { volume: item.volume, muted: false, loop: item.loop }
      this.controls.set(item.id, control)
    }
    return control
  }

  private updateItemControl(audioItemId: string, control: ItemControl): void {
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.item.id === audioItemId) {
        Object.assign(runtime.instance, control)
        this.applyNativeVolume(runtime)
      }
    }
    for (const runtime of this.webRuntimes.values()) {
      if (runtime.item.id === audioItemId) {
        Object.assign(runtime.instance, control)
        runtime.gain.gain.setValueAtTime(control.muted ? 0 : control.volume, this.context?.currentTime ?? 0)
      }
    }
    this.emit()
  }

  private startWebEffect(item: AudioItem, buffer: AudioBuffer): void {
    if (!this.context || !this.masterGain) throw new Error('Web Audio ist nicht verfügbar.')
    const control = this.controlFor(item)
    const gain = this.context.createGain()
    gain.gain.value = control.muted ? 0 : control.volume
    gain.connect(this.masterGain)
    const id = crypto.randomUUID()
    const runtime: WebRuntime = {
      instance: {
        id,
        audioItemId: item.id,
        state: 'playing',
        volume: control.volume,
        muted: control.muted,
        loop: control.loop,
        kind: 'effect',
      },
      item,
      buffer,
      gain,
      startedAt: 0,
      offset: 0,
      intentionalStop: false,
    }
    this.webRuntimes.set(id, runtime)
    this.startWebSource(runtime)
    this.emit()
  }

  private startWebSource(runtime: WebRuntime): void {
    if (!this.context) return
    const source = this.context.createBufferSource()
    source.buffer = runtime.buffer
    source.loop = runtime.instance.loop
    source.connect(runtime.gain)
    runtime.source = source
    runtime.intentionalStop = false
    runtime.startedAt = this.context.currentTime
    runtime.instance.state = 'playing'
    source.onended = () => {
      if (!runtime.intentionalStop && runtime.instance.state === 'playing') this.removeWeb(runtime.instance.id)
    }
    const offset = runtime.instance.loop && runtime.buffer.duration
      ? runtime.offset % runtime.buffer.duration
      : Math.min(runtime.offset, Math.max(0, runtime.buffer.duration - 0.001))
    source.start(0, offset)
  }

  private async startNativeEffect(item: AudioItem): Promise<void> {
    const control = this.controlFor(item)
    const url = URL.createObjectURL(item.audioBlob)
    const element = new Audio(url)
    const id = crypto.randomUUID()
    const runtime: NativeRuntime = {
      item,
      element,
      url,
      instance: {
        id,
        audioItemId: item.id,
        state: 'playing',
        volume: control.volume,
        muted: control.muted,
        loop: control.loop,
        kind: 'effect',
      },
    }
    element.loop = control.loop
    this.applyNativeVolume(runtime)
    element.onended = () => this.removeNative(id)
    element.onerror = () => this.removeNative(id)
    this.nativeRuntimes.set(id, runtime)
    try {
      await element.play()
      this.emit()
    } catch (error) {
      this.removeNative(id)
      throw new Error(error instanceof Error ? error.message : 'Der Effekt konnte nicht gestartet werden.')
    }
  }

  private pauseNative(runtime: NativeRuntime): void {
    runtime.element.pause()
    runtime.instance.state = 'paused'
  }

  private pauseWeb(runtime: WebRuntime): void {
    if (!this.context || !runtime.source) return
    runtime.offset += Math.max(0, this.context.currentTime - runtime.startedAt)
    runtime.intentionalStop = true
    runtime.source.stop()
    runtime.source.disconnect()
    runtime.source = undefined
    runtime.instance.state = 'paused'
  }

  private async stopNative(runtime: NativeRuntime): Promise<void> {
    if (runtime.instance.state === 'playing' && this.fadeDurationMs > 0) {
      await this.fadeElement(runtime.element, runtime.element.volume, 0, this.fadeDurationMs)
    }
    runtime.element.pause()
    this.removeNative(runtime.instance.id)
  }

  private stopWeb(runtime: WebRuntime): void {
    if (this.context && runtime.instance.state === 'playing' && this.fadeDurationMs > 0) {
      const now = this.context.currentTime
      runtime.gain.gain.cancelScheduledValues(now)
      runtime.gain.gain.setValueAtTime(runtime.gain.gain.value, now)
      runtime.gain.gain.linearRampToValueAtTime(0, now + this.fadeDurationMs / 1000)
      window.setTimeout(() => this.removeWeb(runtime.instance.id), this.fadeDurationMs)
    } else {
      this.removeWeb(runtime.instance.id)
    }
    runtime.instance.state = 'stopped'
    this.emit()
  }

  private removeNative(id: string): void {
    const runtime = this.nativeRuntimes.get(id)
    if (!runtime) return
    runtime.element.pause()
    runtime.element.onended = null
    runtime.element.onerror = null
    runtime.element.removeAttribute('src')
    runtime.element.load()
    URL.revokeObjectURL(runtime.url)
    this.nativeRuntimes.delete(id)
    this.globallyPausedIds.delete(id)
    this.emit()
  }

  private removeWeb(id: string): void {
    const runtime = this.webRuntimes.get(id)
    if (!runtime) return
    runtime.intentionalStop = true
    try { runtime.source?.stop() } catch { /* already stopped */ }
    runtime.source?.disconnect()
    runtime.gain.disconnect()
    this.webRuntimes.delete(id)
    this.globallyPausedIds.delete(id)
    this.emit()
  }

  private applyNativeVolume(runtime: NativeRuntime): void {
    runtime.element.volume = runtime.instance.muted ? 0 : clampVolume(runtime.instance.volume * masterGainFor(this.masterVolume))
  }

  private updateAllVolumes(): void {
    for (const runtime of this.nativeRuntimes.values()) this.applyNativeVolume(runtime)
    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(masterGainFor(this.masterVolume), this.context.currentTime)
    }
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context || this.context.state === 'closed') {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) throw new Error('Web Audio wird nicht unterstützt.')
      this.context = new AudioContextClass()
      this.masterGain = this.context.createGain()
      this.masterGain.gain.value = masterGainFor(this.masterVolume)
      this.masterGain.connect(this.context.destination)
    }
    if (this.context.state === 'suspended') await this.withTimeout(this.context.resume())
    return this.context
  }

  private async rebuildContext(): Promise<void> {
    try { await this.context?.close() } catch { /* best effort */ }
    this.context = undefined
    this.masterGain = undefined
    this.bufferCache.clear()
  }

  private async bufferFor(item: AudioItem, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(item.id)
    if (cached) {
      cached.usedAt = Date.now()
      return cached.buffer
    }
    const buffer = await context.decodeAudioData(await item.audioBlob.arrayBuffer())
    const bytes = buffer.length * buffer.numberOfChannels * 4
    this.bufferCache.set(item.id, { buffer, bytes, usedAt: Date.now() })
    this.trimBufferCache()
    return buffer
  }

  private trimBufferCache(): void {
    let total = Array.from(this.bufferCache.values()).reduce((sum, entry) => sum + entry.bytes, 0)
    const entries = [...this.bufferCache.entries()].sort((a, b) => a[1].usedAt - b[1].usedAt)
    for (const [id, entry] of entries) {
      if (total <= BUFFER_CACHE_LIMIT) break
      this.bufferCache.delete(id)
      total -= entry.bytes
    }
  }

  private fadeElement(element: HTMLAudioElement, from: number, to: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const started = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / duration)
        element.volume = clampVolume(from + (to - from) * progress)
        if (progress < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('Audio-Timeout')), WEB_AUDIO_TIMEOUT_MS)),
    ])
  }

  private syncState = (): void => {
    for (const runtime of this.nativeRuntimes.values()) {
      if (runtime.element.ended) this.removeNative(runtime.instance.id)
      else if (runtime.element.paused && runtime.instance.state === 'playing') runtime.instance.state = 'paused'
    }
    this.emit()
  }

  private configureMediaSession(): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Paper Bard Session',
      artist: 'Lokales Soundboard',
    })
    try {
      navigator.mediaSession.setActionHandler('play', () => { void this.resumeAll() })
      navigator.mediaSession.setActionHandler('pause', () => this.pauseAll())
      navigator.mediaSession.setActionHandler('stop', () => { void this.stopAll() })
    } catch {
      // Some WebKit versions expose Media Session without every action.
    }
  }

  private emit(): void {
    this.snapshot = {
      instances: [
        ...Array.from(this.nativeRuntimes.values(), ({ instance }) => ({ ...instance })),
        ...Array.from(this.webRuntimes.values(), ({ instance }) => ({ ...instance })),
      ],
      masterVolume: this.masterVolume,
      globallyPaused: this.globallyPaused,
    }
    this.listeners.forEach((listener) => listener())
  }
}