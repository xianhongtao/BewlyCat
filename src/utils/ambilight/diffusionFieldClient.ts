import type { DiffusionFieldGeometry } from './diffusionField'
import type { DiffusionWorkerResponse } from './diffusionFieldProtocol'
import DiffusionFieldWorker from './diffusionFieldWorker?worker&inline'

export interface DiffusionSolveRequest {
  key: string
  geometry: DiffusionFieldGeometry
  source: Uint8ClampedArray
  decayLengthPx: number
  blend: number
  force: boolean
  reset: boolean
  iterations: number
  featherCells: number
}

export interface DiffusionSolveResult {
  key: string
  width: number
  height: number
  rgba: Uint8ClampedArray
  display: Float32Array
  elapsed: number
}

interface DiffusionFieldWorkerClientOptions {
  onResult: (result: DiffusionSolveResult) => void
  onFailure: (error: unknown) => void
  onSettled: () => void
}

/**
 * 内容脚本与页面不同源，不能用扩展 URL 启动 Worker。
 * Vite 将求解器打成经典 IIFE，再用 blob 启动；这样 Chrome 与 Firefox 的内容脚本都能加载。
 * 同一时刻只投递一帧，几何代际不匹配的结果直接丢掉。
 */
export class DiffusionFieldWorkerClient {
  private worker: Worker | null = null
  private generation = 0
  private busy = false
  private disposed = false
  private failed = false
  private readonly options: DiffusionFieldWorkerClientOptions

  constructor(options: DiffusionFieldWorkerClientOptions) {
    this.options = options
  }

  public get isBusy(): boolean {
    return this.busy
  }

  /** 布局、seek 或视频切换后递增代际，在途的旧结果不再绘制。 */
  public invalidate(): void {
    this.generation++
  }

  public destroy(): void {
    if (this.disposed)
      return
    this.disposed = true
    this.generation++
    this.busy = false
    this.stopWorker()
  }

  /**
   * 把一帧源像素交给 Worker。成功时转移 source.buffer，调用方不得再使用它。
   * Worker 正忙或已销毁时返回 false，不转移缓冲。
   */
  public solve(request: DiffusionSolveRequest): boolean {
    if (this.disposed || this.failed || this.busy)
      return false

    const worker = this.ensureWorker()
    const source = request.source
    const buffer = source.buffer
    if (!(buffer instanceof ArrayBuffer))
      throw new Error('Diffusion source buffer is not transferable')

    this.busy = true
    try {
      worker.postMessage({
        type: 'render',
        generation: this.generation,
        key: request.key,
        geometry: request.geometry,
        source,
        decayLengthPx: request.decayLengthPx,
        blend: request.blend,
        force: request.force,
        reset: request.reset,
        iterations: request.iterations,
        featherCells: request.featherCells,
      }, [buffer])
    }
    catch (error) {
      this.busy = false
      throw error
    }
    return true
  }

  private ensureWorker(): Worker {
    if (this.worker)
      return this.worker

    const worker = new DiffusionFieldWorker({ name: 'bewly-ambilight-diffusion' })
    worker.onmessage = (event: MessageEvent<DiffusionWorkerResponse>) => {
      this.handleMessage(event.data)
    }
    worker.onmessageerror = () => {
      this.fail(new Error('Ambilight diffusion worker message failed'))
    }
    worker.onerror = () => {
      this.fail(new Error('Ambilight diffusion worker failed'))
    }
    this.worker = worker
    return worker
  }

  private handleMessage(data: DiffusionWorkerResponse): void {
    if (this.disposed || !data)
      return

    const stale = data.generation !== this.generation
    this.busy = false
    if (stale) {
      this.options.onSettled()
      return
    }

    if (data.type === 'result') {
      this.options.onResult({
        key: data.key,
        width: data.width,
        height: data.height,
        rgba: data.rgba,
        display: data.display,
        elapsed: data.elapsed,
      })
      if (!this.disposed)
        this.options.onSettled()
      return
    }

    if (data.type === 'empty') {
      this.options.onSettled()
      return
    }

    if (data.type === 'error')
      this.fail(new Error(data.message))
  }

  private fail(error: unknown): void {
    if (this.failed || this.disposed)
      return
    this.failed = true
    this.disposed = true
    this.busy = false
    this.stopWorker()
    this.options.onFailure(error)
  }

  private stopWorker(): void {
    const worker = this.worker
    this.worker = null
    if (!worker)
      return
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
  }
}
