import { describe, it, expect } from 'vitest'
import { buildCostedPaths, type CostedPathsInput } from './costed-paths'

const BASE: CostedPathsInput = {
  offerActual: 100_000,
  offerFte: 1,
  fullRemediationCost: 50_000,
  fullRemediationHeadcount: 5,
  inversionRemediationCost: 48_000,
  inversionRemediationHeadcount: 4,
  gatedCeiling: 87_619.047619,
  offerFteSalary: 100_000,
  marketReference: 104_000,
}

describe('buildCostedPaths', () => {
  it('prices paying the offer and fixing everything', () => {
    const pathA = buildCostedPaths(BASE)[0]

    expect(pathA.id).toBe('A')
    expect(pathA.remediationCost).toBe(50_000)
    expect(pathA.totalFirstYearCost).toBe(150_000)
    expect(pathA.fixesHeadcount).toBe(5)
  })

  it('prices paying the ceiling and fixing nothing', () => {
    const pathB = buildCostedPaths(BASE).find((path) => path.id === 'B')

    expect(pathB?.offerActual).toBeCloseTo(87_619.047619, 6)
    expect(pathB?.remediationCost).toBe(0)
    expect(pathB?.offerReduction).toBeCloseTo(12_380.952381, 6)
    expect(pathB?.belowMarketBy).toBeCloseTo(16_380.952381, 6)
  })

  it('prices the middle route of fixing only inversions', () => {
    const pathC = buildCostedPaths(BASE).find((path) => path.id === 'C')

    expect(pathC?.remediationCost).toBe(48_000)
    expect(pathC?.totalFirstYearCost).toBe(148_000)
    expect(pathC?.fixesHeadcount).toBe(4)
  })

  it('keeps the fixed order and never sorts by cost', () => {
    // Sorting by cost is ranking by another name, and the spec forbids ranking.
    expect(buildCostedPaths(BASE).map((path) => path.id)).toEqual(['A', 'B', 'C'])
  })

  it('converts the ceiling to actual pay for a part-time offer', () => {
    const pathB = buildCostedPaths({ ...BASE, offerActual: 50_000, offerFte: 0.5 })
      .find((path) => path.id === 'B')

    // The ceiling is a full-time figure; a 0.5 FTE hire pays half of it.
    expect(pathB?.offerActual).toBeCloseTo(43_809.5238, 4)
  })

  it('omits the ceiling path when there is no constraint', () => {
    // A zero would read as "pay nothing", which is not what "no ceiling" means.
    const paths = buildCostedPaths({ ...BASE, gatedCeiling: null })

    expect(paths.map((path) => path.id)).toEqual(['A', 'C'])
  })

  it('omits the inversion path when it would duplicate paying for everything', () => {
    const paths = buildCostedPaths({
      ...BASE,
      inversionRemediationCost: 50_000,
      inversionRemediationHeadcount: 5,
    })

    expect(paths.map((path) => path.id)).toEqual(['A', 'B'])
  })

  it('omits the inversion path when there are no inversions', () => {
    const paths = buildCostedPaths({
      ...BASE,
      inversionRemediationCost: 0,
      inversionRemediationHeadcount: 0,
    })

    expect(paths.map((path) => path.id)).toEqual(['A', 'B'])
  })

  it('omits the market comparison when no market number was given', () => {
    const pathB = buildCostedPaths({ ...BASE, marketReference: undefined })
      .find((path) => path.id === 'B')

    expect(pathB?.belowMarketBy).toBeUndefined()
    expect(pathB?.offerReduction).toBeCloseTo(12_380.952381, 6)
  })

  it('always offers at least the pay-and-fix path', () => {
    const paths = buildCostedPaths({
      ...BASE,
      fullRemediationCost: 0,
      fullRemediationHeadcount: 0,
      inversionRemediationCost: 0,
      inversionRemediationHeadcount: 0,
      gatedCeiling: null,
    })

    expect(paths).toHaveLength(1)
    expect(paths[0].totalFirstYearCost).toBe(100_000)
  })
})
