import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSplits, reduceHrSeries, runIdOf } from './analysis'
import { extractFit, garminIdFromName, parseFit, parseFitFile } from './fit'

const fit = new Uint8Array(readFileSync(new URL('../../scripts/fixtures/sortie-5km.fit', import.meta.url)))
const zip = new Uint8Array(readFileSync(new URL('../../scripts/fixtures/sortie-5km.zip', import.meta.url)))

describe('lecture .fit', () => {
  it('lit distance, temps, allure, FC, tours, heure locale, km par km et série de FC', async () => {
    const r = await parseFit(fit)
    expect(r.km).toBe(5)
    expect(r.seconds).toBe(1630)
    expect(r.avgPaceSec).toBe(326)
    expect(r.avgHr).toBe(150)
    expect(r.maxHr).toBe(172)
    expect(r.elevationGain).toBe(38)
    expect(r.activityType).toBe('route')
    expect(r.startAt).toBe('2026-11-20T08:30:00') // 07:30 UTC + 1 h (local_timestamp du fichier)
    expect(r.laps).toHaveLength(5)
    expect(r.laps![0]).toMatchObject({ meters: 1000, seconds: 305, avgPaceSec: 305 })
    expect(r.splits).toHaveLength(5)
    expect(r.splits!.map((s) => s.avgPaceSec)).toEqual([305, 305, 340, 340, 340])
    expect(r.hrSeries![0]).toEqual({ t: 0, hr: 128 })
    expect(r.hrSeries!.length).toBeGreaterThan(150)
    expect(r.hrSeries![1].t - r.hrSeries![0].t).toBe(10)
  })
  it('lit le .zip « Exporter l\'original » et retrouve l\'id Garmin dans le nom', async () => {
    expect(extractFit(zip).name).toBe('12345678901_ACTIVITY.fit')
    const r = await parseFitFile(zip, 'sortie.zip')
    expect(r.externalId).toBe('garmin:12345678901')
    expect(r.km).toBe(5)
    expect((await parseFitFile(fit, '12345678901_ACTIVITY.fit')).externalId).toBe('garmin:12345678901')
    expect((await parseFitFile(fit, 'mon fichier.fit')).externalId).toBeUndefined()
  })
  it('refuse un fichier qui n\'est pas un .fit', async () => {
    await expect(parseFit(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]))).rejects.toBeDefined()
  })
  it('l\'heure locale fournie par ailleurs prime', async () => {
    expect((await parseFit(fit, { localStartAt: '2026-11-20T09:00:00' })).startAt).toBe('2026-11-20T09:00:00')
  })
})

describe('analyse', () => {
  it('garminIdFromName', () => {
    expect(garminIdFromName('12345678901.zip')).toBe('12345678901')
    expect(garminIdFromName('activity_12345678901.fit')).toBe('12345678901')
    expect(garminIdFromName('run.fit')).toBeUndefined()
  })
  it('km par km avec dernier km partiel', () => {
    // 2,4 km à 6:00/km
    const pts = Array.from({ length: 25 }, (_, i) => ({ t: i * 144 / 10 * 10 / 10, d: i * 100, hr: 140 }))
    const s = buildSplits(pts.map((p, i) => ({ t: i * 36, d: i * 100, hr: 140 + i })))
    expect(s).toHaveLength(3)
    expect(s[0]).toMatchObject({ km: 1, seconds: 360, avgPaceSec: 360 })
    expect(s[2].km).toBeCloseTo(0.4, 2)
    expect(s[2].avgPaceSec).toBe(360)
    void pts
  })
  it('ignore un reste inférieur à 50 m', () => {
    expect(buildSplits([{ t: 0, d: 0 }, { t: 360, d: 1000 }, { t: 370, d: 1030 }])).toHaveLength(1)
  })
  it('réduit la série de FC à un point toutes les 10 s', () => {
    const raw = Array.from({ length: 60 }, (_, t) => ({ t, hr: 100 + t }))
    const r = reduceHrSeries(raw, 10)
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ t: 0, hr: 105 })
    expect(r[5].t).toBe(50)
  })
  it('identifiant déterministe', () => {
    expect(runIdOf('garmin:123')).toBe('ir-garmin-123')
    expect(runIdOf('garmin:123')).toBe(runIdOf('garmin:123'))
  })
})
