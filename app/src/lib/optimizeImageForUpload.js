const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.7

function scaledDimensions(width, height, maxDimension) {
  const longest = Math.max(width, height)
  if (longest <= maxDimension) {
    return { width, height }
  }

  const scale = maxDimension / longest
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

export async function optimizeImageForUpload(
  file,
  { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {},
) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height, maxDimension)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Failed to compress image'))),
        'image/jpeg',
        quality,
      )
    })

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
