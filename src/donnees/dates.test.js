import { describe, expect, it } from 'vitest'
import { estDateValide } from './dates.js'

describe('estDateValide (AAAA-MM-JJ)', () => {
  it('accepte des dates réelles', () => {
    expect(estDateValide('2026-11-16')).toBe(true)
    expect(estDateValide('2028-02-29')).toBe(true) // année bissextile
  })

  it('refuse les dates qui n’existent pas', () => {
    expect(estDateValide('2026-02-30')).toBe(false)
    expect(estDateValide('2027-02-29')).toBe(false)
    expect(estDateValide('2026-13-01')).toBe(false)
    expect(estDateValide('2026-00-10')).toBe(false)
  })

  it('refuse les autres formats et les autres types', () => {
    expect(estDateValide('16/11/2026')).toBe(false)
    expect(estDateValide('2026-1-5')).toBe(false)
    expect(estDateValide('2026-11-16T10:00')).toBe(false)
    expect(estDateValide(null)).toBe(false)
    expect(estDateValide(20261116)).toBe(false)
  })
})
