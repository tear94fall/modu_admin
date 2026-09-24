import { describe, expect, it } from 'vitest'
import { cleanGroups, combinations, optionKey, optionLabel, reconcileSkus, splitValues } from './options'

const colorSize = [
  { name: '색상', values: ['블랙', '화이트'] },
  { name: '사이즈', values: ['M', 'L'] },
]

describe('options', () => {
  it('builds every combination in group order', () => {
    expect(combinations(colorSize)).toEqual([
      { 색상: '블랙', 사이즈: 'M' },
      { 색상: '블랙', 사이즈: 'L' },
      { 색상: '화이트', 사이즈: 'M' },
      { 색상: '화이트', 사이즈: 'L' },
    ])
    expect(combinations([])).toEqual([{}])
  })

  it('drops blank names, blank and duplicate values', () => {
    expect(cleanGroups([{ name: ' 색상 ', values: ['블랙', '', '블랙', ' 화이트 '] }, { name: '', values: ['x'] }])).toEqual([
      { name: '색상', values: ['블랙', '화이트'] },
    ])
  })

  it('keys and labels match the server rule', () => {
    expect(optionKey({ 사이즈: 'M', 색상: '블랙' })).toBe('사이즈=M|색상=블랙')
    expect(optionLabel(colorSize, { 색상: '블랙', 사이즈: 'M' })).toBe('블랙 / M')
    expect(optionLabel([], {})).toBe('')
  })

  it('keeps typed stock for surviving combinations and zeroes new ones', () => {
    const previous = [
      { options: { 색상: '블랙', 사이즈: 'M' }, extraPrice: '500', stock: '7' },
      { options: { 색상: '블랙', 사이즈: 'L' }, extraPrice: '0', stock: '1' },
    ]
    const next = reconcileSkus(previous, [
      { name: '색상', values: ['블랙', '네이비'] },
      { name: '사이즈', values: ['M'] },
    ])
    expect(next).toEqual([
      { options: { 색상: '블랙', 사이즈: 'M' }, extraPrice: '500', stock: '7' },
      { options: { 색상: '네이비', 사이즈: 'M' }, extraPrice: '0', stock: '0' },
    ])
  })

  it('splits comma separated values', () => {
    expect(splitValues('블랙, 화이트 ,네이비')).toEqual(['블랙', '화이트', '네이비'])
  })
})
