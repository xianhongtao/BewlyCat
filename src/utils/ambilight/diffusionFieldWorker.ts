import { AmbilightDiffusionField } from './diffusionField'
import type { DiffusionWorkerRequest, DiffusionWorkerResponse } from './diffusionFieldProtocol'

interface DiffusionWorkerScope {
  onmessage: ((event: MessageEvent<DiffusionWorkerRequest>) => void) | null
  postMessage: (message: DiffusionWorkerResponse, transfer?: Transferable[]) => void
}

// 经典 Worker 没有 Window.postMessage 的 targetOrigin 重载，单独收窄类型。
const scope = globalThis as unknown as DiffusionWorkerScope

let field: AmbilightDiffusionField | null = null
let fieldKey = ''

function post(message: DiffusionWorkerResponse, transfer?: Transferable[]): void {
  if (transfer)
    scope.postMessage(message, transfer)
  else
    scope.postMessage(message)
}

scope.onmessage = (event: MessageEvent<DiffusionWorkerRequest>) => {
  const message = event.data
  if (!message || message.type !== 'render')
    return

  try {
    if (!field || fieldKey !== message.key) {
      field = new AmbilightDiffusionField(message.geometry)
      fieldKey = message.key
    }

    if (!field.hasFixedPixels) {
      post({ type: 'empty', generation: message.generation, key: message.key })
      return
    }

    // 与原先主线程顺序一致：seek / 换布局先重建初值，耗时从随后的 render 起算。
    if (message.reset)
      field.reset(message.source)

    const started = performance.now()
    field.render(
      message.source,
      message.decayLengthPx,
      message.blend,
      message.force,
      message.iterations,
      message.featherCells,
    )
    const elapsed = performance.now() - started
    const rgba = field.copyOutput()
    const display = field.copyDisplay()
    post({
      type: 'result',
      generation: message.generation,
      key: message.key,
      width: field.width,
      height: field.height,
      rgba,
      display,
      elapsed,
    }, [rgba.buffer, display.buffer])
  }
  catch (error) {
    post({
      type: 'error',
      generation: message.generation,
      key: message.key,
      message: error instanceof Error ? error.message : 'Diffusion solve failed',
    })
  }
}
