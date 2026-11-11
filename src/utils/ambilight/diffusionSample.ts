// 与扩散场 writeOutput 相同：alpha 低于该值时颜色按 0 处理，避免除出噪声。
export const MIN_ALPHA_FOR_COLOR = 0.002

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 按光晕矩形内的归一化坐标双线性采样已完成的预乘显示场。
 * 在预乘空间插值后再除回 alpha，返回非预乘颜色的 sRGB 编码亮度与 alpha。
 * display 为最近一次 Worker 求解完成后的场，采样本身不求解。
 */
export function sampleDiffusionDisplay(
  display: ArrayLike<number>,
  width: number,
  height: number,
  u: number,
  v: number,
): { luma: number, alpha: number } {
  const fx = clamp(u * width - 0.5, 0, width - 1)
  const fy = clamp(v * height - 0.5, 0, height - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0

  let luma = 0
  let alpha = 0
  const accumulate = (x: number, y: number, weight: number) => {
    const base = (y * width + x) * 4
    luma += weight * (0.2126 * display[base] + 0.7152 * display[base + 1] + 0.0722 * display[base + 2])
    alpha += weight * display[base + 3]
  }
  accumulate(x0, y0, (1 - tx) * (1 - ty))
  accumulate(x1, y0, tx * (1 - ty))
  accumulate(x0, y1, (1 - tx) * ty)
  accumulate(x1, y1, tx * ty)

  return {
    luma: alpha > MIN_ALPHA_FOR_COLOR ? clamp(luma / alpha, 0, 1) : 0,
    alpha: clamp(alpha, 0, 1),
  }
}
