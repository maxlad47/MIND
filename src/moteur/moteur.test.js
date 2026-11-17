import { describe, expect, it } from 'vitest'
import * as moteur from './index.js'

describe('moteur', () => {
  it('se charge sans erreur', () => {
    expect(typeof moteur).toBe('object')
  })
})
