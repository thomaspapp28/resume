/**
 * Trigger download of a base64-encoded file.
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} filename
 */
export function downloadBlob(base64, mimeType, filename) {
  if (!base64) return
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
