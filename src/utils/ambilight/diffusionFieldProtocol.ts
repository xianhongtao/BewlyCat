import type { DiffusionFieldGeometry } from './diffusionField'

export interface DiffusionWorkerRenderRequest {
  type: 'render'
  generation: number
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

export interface DiffusionWorkerResult {
  type: 'result'
  generation: number
  key: string
  width: number
  height: number
  rgba: Uint8ClampedArray
  display: Float32Array
  elapsed: number
}

export interface DiffusionWorkerEmpty {
  type: 'empty'
  generation: number
  key: string
}

export interface DiffusionWorkerError {
  type: 'error'
  generation: number
  key: string
  message: string
}

export type DiffusionWorkerRequest = DiffusionWorkerRenderRequest
export type DiffusionWorkerResponse = DiffusionWorkerResult | DiffusionWorkerEmpty | DiffusionWorkerError
