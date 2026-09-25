import type { CSSProperties } from 'react'

/**
 * Estilo pra um <img className="object-cover"> respeitar ponto focal + zoom.
 * `zoom` é 100-300 (= 1x-3x, mesma escala salva no banco) — 100 não aplica
 * nenhum transform (idêntico ao comportamento antes do zoom existir).
 *
 * Aproximação, não matemática exata: `transformOrigin` usa os mesmos valores
 * de `objectPosition`, o que só ancora o ponto focal com precisão de pixel
 * quando ele está próximo do centro (50%/50%) — pra focos bem excêntricos
 * ainda desloca um pouco. É suficiente aqui (ajuste visual, não recorte
 * cirúrgico) e evita ter que medir a imagem em JS a cada instância renderizada.
 */
export function focalImageStyle(focalX: number, focalY: number, zoom: number = 100): CSSProperties {
  const position = `${focalX}% ${focalY}%`
  return {
    objectPosition: position,
    transformOrigin: position,
    transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
  }
}
