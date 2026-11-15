import { describe, expect, it } from 'vitest'
import { ES } from './i18n-es'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('Spanish table', () => {
  it('keeps every number placeholder from the English text', () => {
    for (const [english, spanish] of Object.entries(ES)) {
      expect(placeholders(spanish), english).toEqual(placeholders(english))
    }
  })

  it('has no empty strings and no em dashes', () => {
    for (const [english, spanish] of Object.entries(ES)) {
      expect(spanish.trim(), english).not.toBe('')
      expect(spanish, english).not.toContain(String.fromCharCode(0x2014))
    }
  })
})
