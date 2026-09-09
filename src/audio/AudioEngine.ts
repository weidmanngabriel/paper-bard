import type { AudioItem, AudioSnapshot, PlaybackInstance } from '../domain/types'
import { clampVolume } from '../domain/types'

type Listener = () => void
type Control = { volume: number; muted: boolean; loop: boolean }
type NativeRuntime = {
  instance: PlaybackInstance
  item: AudioItem
  element: HTMLAudioElement
  url: string
  source?: MediaElementAudioSourceNode
  gain?: GainNode
}
type WebRuntime = {
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
const masterGainFor = (volume: number) => {
  const value = clampVolume(volume)
  return value * value
}

export class AudioEngine {
  private listeners = new Set<Listener>()
  private controls = new Map<string, Control>()
  private native = new Map<string, NativeRuntime>()
  private web = new Map<string, WebRuntime>()
  private globallyPausedIds = new Set<string>()
  private manuallyPausedIds = new Set<string>()
  private context?: AudioContext
  private masterGain?: GainNode
  private bufferCache = new Map<string, { buffer: AudioBuffer; bytes: number; usedAt: number }>()
  private masterVolume = 0.85
  private fadeDurationMs = 350
  private globallyPaused = false
  private snapshot: AudioSnapshot = { instances: [], masterVolume: 0.85, globallyPaused: false }

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('pageshow', this.syncState)
    document.addEventListener('visibilitychange', this.syncState)
    this.configureMediaSession()
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot
  getItemControl(item: AudioItem): Control { return { ...this.controlFor(item) } }

  setDefaults(masterVolume: number, fadeDurationMs: number): void {
    this.masterVolume = clampVolume(masterVolume)
    this.fadeDurationMs = Math.max(0, Math.min(5000, fadeDurationMs))
    this.updateAllVolumes()
    this.emit()
  }

  async play(item: AudioItem): Promise<void> {
    await this.activate()
    if (item.type === 'soundEffect') await this.playEffect(item)
    else await this.playTrack(item)
  }

  async playTrack(item: AudioItem): Promise<void> {
    const existing = [...this.native.values()].find((runtime) => runtime.item.id === item.id && runtime.instance.kind === 'track')
    if (existing) {
      if (existing.instance.state === 'paused') await this.resumeNative(existing)
      return
    }
    const control = this.controlFor(item)
    const runtime = this.makeNative(item, 'track', control)
    await this.routeTrack(runtime)
    this.applyNativeVolume(runtime)
    this.native.set(runtime.instance.id, runtime)
    try {
      await runtime.element.play()
      this.emit()
    } catch (error) {
      this.removeNative(runtime.instance.id)
      throw new Error(error instanceof Error ? error.message : 'Der Track konnte nicht gestartet werden.')
    }
  }

  async playEffect(item: AudioItem): Promise<void> {
    try {
      const context = await this.ensureContext()
      this.startWebEffect(item, await this.bufferFor(item, context))
    } catch {
      const runtime = this.makeNative(item, 'effect', this.controlFor(item))
      this.applyNativeVolume(runtime)
      this.native.set(runtime.instance.id, runtime)
      try {
        await runtime.element.play()
        this.emit()
      } catch (error) {
        this.removeNative(runtime.instance.id)
        throw new Error(error instanceof Error ? error.message : 'Der Effekt konnte nicht gestartet werden.')
      }
    }
  }

  pauseItem(audioItemId: string): void {
    for (const runtime of this.native.values()) {
      if (runtime.item.id !== audioItemId || runtime.instance.state !== 'playing') continue
      this.pauseNative(runtime)
      this.manuallyPausedIds.add(runtime.instance.id)
      this.globallyPausedIds.delete(runtime.instance.id)
    }
    for (const runtime of this.web.values()) {
      if (runtime.item.id !== audioItemId || runtime.instance.state !== 'playing') continue
      this.pauseWeb(runtime)
      this.manuallyPausedIds.add(runtime.instance.id)
      this.globallyPausedIds.delete(runtime.instance.id)
    }
    this.refreshGlobalPause()
    this.emit()
  }

  async resumeItem(audioItemId: string): Promise<void> {
    await this.activate()
    const tasks: Promise<void>[] = []
    for (const runtime of this.native.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'paused') tasks.push(this.resumeNative(runtime))
    }
    for (const runtime of this.web.values()) {
      if (runtime.item.id === audioItemId && runtime.instance.state === 'paused') {
        this.startWebSource(runtime)
        this.clearPauseMarkers(runtime.instance.id)
      }
    }
    await Promise.all(tasks)
    this.refreshGlobalPause()
    this.emit()
  }

  async stopItem(audioItemId: string): Promise<void> {
    const native = [...this.native.values()].filter((runtime) => runtime.item.id === audioItemId)
    const web = [...this.web.values()].filter((runtime) => runtime.item.id === audioItemId)
    await Promise.all(native.map((runtime) => this.stopNative(runtime)))
    web.forEach((runtime) => this.stopWeb(runtime))
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.native.values()].map((runtime) => this.stopNative(runtime)))
    ;[...this.web.values()].forEach((runtime) => this.stopWeb(runtime))
    this.globallyPausedIds.clear()
    this.manuallyPausedIds.clear()
    this.globallyPaused = false
    this.emit()
  }

  pauseAll(): void {
    this.globallyPausedIds.clear()
    for (const runtime of this.native.values()) {
      if (runtime.instance.state !== 'playing') continue
      this.globallyPausedIds.add(runtime.instance.id)
      this.pauseNative(runtime)
    }
    for (const runtime of this.web.values()) {
      if (runtime.instance.state !== 'playing') continue
      this.globallyPausedIds.add(runtime.instance.id)
      this.pauseWeb(runtime)
    }
    this.refreshGlobalPause()
    this.emit()
  }

  async resumeAll(): Promise<void> {
    await this.activate()
    const ids = [...this.globallyPausedIds]
    const tasks: Promise<void>[] = []
    for (const id of ids) {
      const native = this.native.get(id)
      if (native?.instance.state === 'paused') tasks.push(this.resumeNative(native))
      const web = this.web.get(id)
      if (web?.instance.state === 'paused') this.startWebSource(web)
    }
    await Promise.allSettled(tasks)
    ids.forEach((id) => this.globallyPausedIds.delete(id))
    this.refreshGlobalPause()
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
    for (const runtime of this.native.values()) if (runtime.item.id === item.id) {
      runtime.instance.loop = loop
      runtime.element.loop = loop
    }
    for (const runtime of this.web.values()) if (runtime.item.id === item.id) {
      runtime.instance.loop = loop
      if (runtime.source) runtime.source.loop = loop
    }
    this.emit()
  }

  async activate(): Promise<void> {
    if (this.context?.state !== 'suspended') return
    try { await this.withTimeout(this.context.resume()) }
    catch { await this.rebuildContext() }
  }

  destroy(): void {
    window.removeEventListener('pageshow', this.syncState)
    document.removeEventListener('visibilitychange', this.syncState)
    ;[...this.native.keys()].forEach((id) => this.removeNative(id))
    ;[...this.web.keys()].forEach((id) => this.removeWeb(id))
    void this.context?.close()
    this.listeners.clear()
  }

  private controlFor(item: AudioItem): Control {
    let control = this.controls.get(item.id)
    if (!control) {
      control = { volume: item.volume, muted: false, loop: item.loop }
      this.controls.set(item.id, control)
    }
    return control
  }

  private makeNative(item: AudioItem, kind: 'track' | 'effect', control: Control): NativeRuntime {
    const url = URL.createObjectURL(item.audioBlob)
    const runtime: NativeRuntime = {
      item,
      url,
      element: new Audio(url),
      instance: { id: crypto.randomUUID(), audioItemId: item.id, state: 'playing', ...control, kind },
    }
    this.configureNative(runtime)
    return runtime
  }

  private configureNative(runtime: NativeRuntime): void {
    runtime.element.preload = 'auto'
    runtime.element.loop = runtime.instance.loop
    runtime.element.onended = () => this.removeNative(runtime.instance.id)
    runtime.element.onerror = () => this.removeNative(runtime.instance.id)
  }

  private async routeTrack(runtime: NativeRuntime): Promise<void> {
    try {
      const context = await this.ensureContext()
      if (!this.masterGain) return
      runtime.source = context.createMediaElementSource(runtime.element)
      runtime.gain = context.createGain()
      runtime.source.connect(runtime.gain)
      runtime.gain.connect(this.masterGain)
      runtime.element.volume = 1
    } catch {
      runtime.source = undefined
      runtime.gain = undefined
    }
  }

  private updateItemControl(audioItemId: string, control: Control): void {
    for (const runtime of this.native.values()) if (runtime.item.id === audioItemId) {
      Object.assign(runtime.instance, control)
      this.applyNativeVolume(runtime)
    }
    for (const runtime of this.web.values()) if (runtime.item.id === audioItemId) {
      Object.assign(runtime.instance, control)
      runtime.gain.gain.setValueAtTime(control.muted ? 0 : control.volume, this.context?.currentTime ?? 0)
    }
    this.emit()
  }

  private startWebEffect(item: AudioItem, buffer: AudioBuffer): void {
    if (!this.context || !this.masterGain) throw new Error('Web Audio ist nicht verfügbar.')
    const control = this.controlFor(item)
    const gain = this.context.createGain()
    gain.gain.value = control.muted ? 0 : control.volume
    gain.connect(this.masterGain)
    const runtime: WebRuntime = {
      item,
      buffer,
      gain,
      startedAt: 0,
      offset: 0,
      intentionalStop: false,
      instance: { id: crypto.randomUUID(), audioItemId: item.id, state: 'playing', ...control, kind: 'effect' },
    }
    this.web.set(runtime.instance.id, runtime)
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
    const duration = runtime.buffer.duration
    const offset = runtime.instance.loop && duration
      ? runtime.offset % duration
      : Math.min(runtime.offset, Math.max(0, duration - 0.001))
    source.start(0, offset)
  }

  private pauseNative(runtime: NativeRuntime): void {
    runtime.element.pause()
    runtime.instance.state = 'paused'
  }
  private pauseWeb(runtime: WebRuntime): void {
    if (!this.context || !runtime.source) return
    runtime.offset += Math.max(0, this.context.currentTime - runtime.startedAt)
    runtime.intentionalStop = true
    try { runtime.source.stop() } catch { /* already stopped */ }
    runtime.source.disconnect()
    runtime.source = undefined
    runtime.instance.state = 'paused'
  }
  private async resumeNative(runtime: NativeRuntime): Promise<void> {
    await runtime.element.play()
    runtime.instance.state = 'playing'
    this.clearPauseMarkers(runtime.instance.id)
  }
  private clearPauseMarkers(id: string): void {
    this.globallyPausedIds.delete(id)
    this.manuallyPausedIds.delete(id)
  }

  private async stopNative(runtime: NativeRuntime): Promise<void> {
    if (runtime.instance.state === 'playing' && this.fadeDurationMs > 0) {
      if (runtime.gain && this.context) {
        const now = this.context.currentTime
        runtime.gain.gain.cancelScheduledValues(now)
        runtime.gain.gain.setValueAtTime(runtime.gain.gain.value, now)
        runtime.gain.gain.linearRampToValueAtTime(0, now + this.fadeDurationMs / 1000)
        await new Promise<void>((resolve) => window.setTimeout(resolve, this.fadeDurationMs))
      } else await this.fadeElement(runtime.element, runtime.element.volume, 0, this.fadeDurationMs)
    }
    this.removeNative(runtime.instance.id)
  }

  private stopWeb(runtime: WebRuntime): void {
    if (this.context && runtime.instance.state === 'playing' && this.fadeDurationMs > 0) {
      const now = this.context.currentTime
      runtime.gain.gain.cancelScheduledValues(now)
      runtime.gain.gain.setValueAtTime(runtime.gain.gain.value, now)
      runtime.gain.gain.linearRampToValueAtTime(0, now + this.fadeDurationMs / 1000)
      window.setTimeout(() => this.removeWeb(runtime.instance.id), this.fadeDurationMs)
    } else this.removeWeb(runtime.instance.id)
    runtime.instance.state = 'stopped'
    this.emit()
  }

  private removeNative(id: string): void {
    const runtime = this.native.get(id)
    if (!runtime) return
    runtime.element.pause()
    runtime.element.onended = null
    runtime.element.onerror = null
    runtime.source?.disconnect()
    runtime.gain?.disconnect()
    runtime.element.removeAttribute('src')
    runtime.element.load()
    URL.revokeObjectURL(runtime.url)
    this.native.delete(id)
    this.clearPauseMarkers(id)
    this.refreshGlobalPause()
    this.emit()
  }

  private removeWeb(id: string): void {
    const runtime = this.web.get(id)
    if (!runtime) return
    runtime.intentionalStop = true
    try { runtime.source?.stop() } catch { /* already stopped */ }
    runtime.source?.disconnect()
    runtime.gain.disconnect()
    this.web.delete(id)
    this.clearPauseMarkers(id)
    this.refreshGlobalPause()
    this.emit()
  }

  private applyNativeVolume(runtime: NativeRuntime): void {
    const itemVolume = runtime.instance.muted ? 0 : clampVolume(runtime.instance.volume)
    if (runtime.gain && this.context) {
      runtime.element.volume = 1
      runtime.gain.gain.setValueAtTime(itemVolume, this.context.currentTime)
    } else runtime.element.volume = clampVolume(itemVolume * masterGainFor(this.masterVolume))
  }
  private updateAllVolumes(): void {
    for (const runtime of this.native.values()) this.applyNativeVolume(runtime)
    if (this.masterGain && this.context) this.masterGain.gain.setValueAtTime(masterGainFor(this.masterVolume), this.context.currentTime)
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
    const oldContext = this.context
    const routed = [...this.native.values()].filter((runtime) => runtime.source || runtime.gain)
    const web = [...this.web.values()]
    for (const runtime of web) {
      if (runtime.instance.state === 'playing' && oldContext && runtime.source) runtime.offset += Math.max(0, oldContext.currentTime - runtime.startedAt)
      runtime.intentionalStop = true
      try { runtime.source?.stop() } catch { /* already stopped */ }
      runtime.source?.disconnect()
      runtime.source = undefined
      runtime.gain.disconnect()
    }
    for (const runtime of routed) {
      runtime.source?.disconnect()
      runtime.gain?.disconnect()
      runtime.source = undefined
      runtime.gain = undefined
    }
    try { await oldContext?.close() } catch { /* best effort */ }
    this.context = undefined
    this.masterGain = undefined
    this.bufferCache.clear()
    if (!routed.length && !web.length) return

    const context = await this.ensureContext()
    const masterGain = this.masterGain
    if (!masterGain) return
    for (const runtime of routed) await this.rebuildNative(runtime)
    for (const runtime of web) {
      runtime.gain = context.createGain()
      runtime.gain.gain.value = runtime.instance.muted ? 0 : runtime.instance.volume
      runtime.gain.connect(masterGain)
      runtime.intentionalStop = false
      if (runtime.instance.state === 'playing') this.startWebSource(runtime)
    }
    this.updateAllVolumes()
    this.emit()
  }

  private async rebuildNative(runtime: NativeRuntime): Promise<void> {
    const previous = runtime.element
    const position = Number.isFinite(previous.currentTime) ? previous.currentTime : 0
    const shouldPlay = runtime.instance.state === 'playing'
    previous.pause()
    previous.onended = null
    previous.onerror = null
    previous.removeAttribute('src')
    previous.load()
    runtime.element = new Audio(runtime.url)
    this.configureNative(runtime)
    try { runtime.element.currentTime = position } catch { /* metadata may not be ready */ }
    await this.routeTrack(runtime)
    this.applyNativeVolume(runtime)
    if (!shouldPlay) return
    try { await runtime.element.play() }
    catch {
      runtime.instance.state = 'paused'
      this.globallyPausedIds.add(runtime.instance.id)
      this.refreshGlobalPause()
    }
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
    let total = [...this.bufferCache.values()].reduce((sum, entry) => sum + entry.bytes, 0)
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
  private refreshGlobalPause(): void { this.globallyPaused = this.globallyPausedIds.size > 0 }

  private syncState = (): void => {
    if (this.context?.state === 'suspended') {
      for (const runtime of this.native.values()) if (runtime.source && runtime.instance.state === 'playing') {
        this.pauseNative(runtime)
        this.globallyPausedIds.add(runtime.instance.id)
      }
      for (const runtime of this.web.values()) if (runtime.instance.state === 'playing') {
        this.pauseWeb(runtime)
        this.globallyPausedIds.add(runtime.instance.id)
      }
    }
    for (const runtime of [...this.native.values()]) {
      if (runtime.element.ended) {
        this.removeNative(runtime.instance.id)
        continue
      }
      if (runtime.element.paused && runtime.instance.state === 'playing') {
        runtime.instance.state = 'paused'
        if (!this.manuallyPausedIds.has(runtime.instance.id)) this.globallyPausedIds.add(runtime.instance.id)
      } else if (!runtime.element.paused && runtime.instance.state === 'paused' && this.globallyPausedIds.has(runtime.instance.id)) {
        runtime.instance.state = 'playing'
        this.globallyPausedIds.delete(runtime.instance.id)
      }
    }
    this.refreshGlobalPause()
    this.emit()
  }

  private configureMediaSession(): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Paper Bard Session', artist: 'Lokales Soundboard' })
    try {
      navigator.mediaSession.setActionHandler('play', () => { void this.resumeAll() })
      navigator.mediaSession.setActionHandler('pause', () => this.pauseAll())
      navigator.mediaSession.setActionHandler('stop', () => { void this.stopAll() })
    } catch { /* WebKit exposes only some actions on older versions. */ }
  }

  private emit(): void {
    this.snapshot = {
      instances: [
        ...[...this.native.values()].map(({ instance }) => ({ ...instance })),
        ...[...this.web.values()].map(({ instance }) => ({ ...instance })),
      ],
      masterVolume: this.masterVolume,
      globallyPaused: this.globallyPaused,
    }
    this.listeners.forEach((listener) => listener())
  }
}
