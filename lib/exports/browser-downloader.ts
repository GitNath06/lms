/**
 * Browser-side streaming binary file downloader.
 * Streams raw binary exports directly from Next.js route handlers,
 * eliminating the 33% Base64 transport overhead while preserving
 * automatic fallback to legacy Server Actions if streaming is blocked.
 */

export interface StreamDownloadOptions {
  filename?: string
  fallbackAction?: () => Promise<{
    success: boolean
    base64?: string
    filename?: string
    contentType?: string
    error?: string
  }>
}

/**
 * Triggers a browser file download from a Blob or URL.
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Parses the filename from Content-Disposition header if available.
 */
function extractFilenameFromHeaders(headers: Headers, defaultName: string): string {
  const disposition = headers.get('content-disposition')
  if (!disposition) return defaultName

  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/)
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1].trim())
    } catch {
      return match[1].trim()
    }
  }
  return defaultName
}

/**
 * Streams a raw binary export from the given API endpoint.
 * Falls back to legacy base64 server action if provided and streaming encounters an issue.
 */
export async function downloadExportStream(
  url: string,
  options: StreamDownloadOptions = {}
): Promise<{ success: boolean; filename: string; streamed: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, */*',
      },
    })

    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const fallbackName = options.filename || 'export-file'
      const filename = extractFilenameFromHeaders(res.headers, fallbackName)

      const blob = await res.blob()
      triggerFileDownload(blob, filename)

      return { success: true, filename, streamed: true }
    }

    // If server returned error response, try to parse JSON error
    const errBody = await res.json().catch(() => null)
    const errMsg = errBody?.error || `Streaming export failed with status ${res.status}`

    // If fallback action is available, execute fallback
    if (options.fallbackAction) {
      console.warn(`[export] Stream endpoint returned ${res.status}. Executing Server Action fallback...`)
      const fallbackRes = await options.fallbackAction()
      if (fallbackRes.success && fallbackRes.base64 && fallbackRes.filename) {
        const byteCharacters = atob(fallbackRes.base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: fallbackRes.contentType || 'application/octet-stream' })
        triggerFileDownload(blob, fallbackRes.filename)
        return { success: true, filename: fallbackRes.filename, streamed: false }
      }
      return { success: false, filename: '', streamed: false, error: fallbackRes.error || errMsg }
    }

    return { success: false, filename: '', streamed: false, error: errMsg }
  } catch (err: any) {
    console.warn('[export] Fetch exception occurred during stream download:', err)

    if (options.fallbackAction) {
      console.warn('[export] Attempting Server Action fallback...')
      try {
        const fallbackRes = await options.fallbackAction()
        if (fallbackRes.success && fallbackRes.base64 && fallbackRes.filename) {
          const byteCharacters = atob(fallbackRes.base64)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: fallbackRes.contentType || 'application/octet-stream' })
          triggerFileDownload(blob, fallbackRes.filename)
          return { success: true, filename: fallbackRes.filename, streamed: false }
        }
        return { success: false, filename: '', streamed: false, error: fallbackRes.error || err.message }
      } catch (fallbackErr: any) {
        return { success: false, filename: '', streamed: false, error: fallbackErr.message }
      }
    }

    return { success: false, filename: '', streamed: false, error: err.message || 'Stream download failed' }
  }
}

/**
 * Downloads a Base64-encoded file directly to the browser.
 */
export function downloadBase64File(
  base64: string,
  filename: string,
  contentType = 'application/octet-stream'
) {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: contentType })
  triggerFileDownload(blob, filename)
}
