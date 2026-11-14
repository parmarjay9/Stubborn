import { useRef } from 'react'

const MAX_SIDE = 2200

/** Shrink big phone photos so they upload fast on weak Wi-Fi. Returns JPEG or PNG. */
export async function prepareImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/png') && file.size < 4_000_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (blob) return blob
  } catch {
    // Fall through and let the type check below decide.
  }
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file
  throw new Error('Please use a JPEG or PNG photo of your pay stub.')
}

export default function StubUpload({ onPick, onManual }: { onPick: (file: File) => void; onManual: () => void }) {
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)

  const picked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onPick(file)
  }

  return (
    <div className="grid gap-3">
      <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-ink/50 bg-card/70 px-5 py-8 text-center">
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
        <p className="font-semibold">Lay the stub flat in good light</p>
        <p className="max-w-xs text-sm text-muted">Make sure the hours, rate, gross pay and pay period dates are in the picture.</p>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={picked} />
      <input ref={library} type="file" accept="image/jpeg,image/png" className="hidden" onChange={picked} />
      <button type="button" className="btn btn-primary" onClick={() => camera.current?.click()}>
        Take a photo
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => library.current?.click()}>
        Choose a picture
      </button>
      <button type="button" className="min-h-12 text-sm font-semibold text-muted underline" onClick={onManual}>
        Type the numbers in instead
      </button>
    </div>
  )
}
