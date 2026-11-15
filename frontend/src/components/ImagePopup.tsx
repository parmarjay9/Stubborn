import { useEffect, useRef } from 'react'
import { t } from '../lib/i18n'

/** Full-size view of an image. Closes with the X button, the Escape key, or a tap outside the image. */
export default function ImagePopup({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // keep the page behind from scrolling
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div className="pop relative mt-14 w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="absolute -top-14 right-0 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-hi text-2xl font-black shadow-hard-sm"
        >
          ×
        </button>
        <img src={src} alt={alt} className="max-h-[75dvh] w-full rounded-lg border-2 border-ink bg-white object-contain shadow-hard" />
      </div>
    </div>
  )
}
