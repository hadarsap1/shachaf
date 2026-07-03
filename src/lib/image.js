// Client-side image compression before upload — mobile photos are often
// 3-10MB; downscale to max 1600px and re-encode as JPEG ~0.82 quality.
// Falls back to the original file on any failure (SVG, HEIC decode issues…).
const MAX_DIM = 1600
const QUALITY = 0.82

export async function compressImage(file) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    // Already small and reasonably sized on disk — keep the original
    if (scale === 1 && file.size < 400 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    // Keep PNG for images that may need transparency (logos), JPEG otherwise
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise(res => canvas.toBlob(res, type, QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name, { type })
  } catch {
    return file
  }
}
