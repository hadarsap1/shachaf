// Client-side image compression before upload — mobile photos are often
// 3-10MB; downscale to max 1600px and re-encode as JPEG ~0.82 quality.
const MAX_DIM = 1600
const QUALITY = 0.82

// Decode via createImageBitmap; on failure (e.g. HEIC in some engines) fall
// back to an <img> element — iOS Safari can render HEIC in <img> even when
// createImageBitmap rejects it, so we can still re-encode to JPEG.
async function decode(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
      img.src = url
    })
  }
}

export async function compressImage(file) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const src = await decode(file)
    const w = src.width || src.naturalWidth
    const h = src.height || src.naturalHeight
    const scale = Math.min(1, MAX_DIM / Math.max(w, h))
    // Already small and reasonably sized on disk — keep the original,
    // unless it's a format that must be converted for cross-browser display
    const needsConvert = !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (scale === 1 && file.size < 400 * 1024 && !needsConvert) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height)
    // Keep PNG for images that may need transparency (logos), JPEG otherwise
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise(res => canvas.toBlob(res, type, QUALITY))
    if (!blob) return file
    if (blob.size >= file.size && !needsConvert) return file
    const name = file.name.replace(/\.(heic|heif|tiff?)$/i, '.jpg')
    return new File([blob], name, { type })
  } catch {
    return file
  }
}
