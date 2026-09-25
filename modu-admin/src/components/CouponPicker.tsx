import { useState } from 'react'
import { type CouponSummary, discountLabel, expiryLabel, quantityLabel, searchCoupons } from '../api/coupons'

interface CouponPickerProps {
  /** 목록·검색 결과의 이름(aria-label) 앞에 붙는 말. 예: "이벤트 쿠폰" */
  label: string
  selected: CouponSummary[]
  onChange: (next: CouponSummary[]) => void
  max: number
}

const couponLine = (c: CouponSummary) => `${discountLabel(c)} · ${expiryLabel(c)} · 발급 ${quantityLabel(c)}`

/** 기획전·이벤트 폼의 쿠폰 고르기. 어드민 쿠폰 목록을 이름·코드로 찾아 붙이고 뺀다. 빈칸으로 찾으면 최근 쿠폰이 나온다. */
export default function CouponPicker({ label, selected, onChange, max }: CouponPickerProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CouponSummary[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSearch = async () => {
    setSearching(true)
    setError(null)
    try {
      const page = await searchCoupons(keyword.trim(), 0)
      setResults(page.content)
    } catch {
      setError('쿠폰을 찾지 못했습니다')
    } finally {
      setSearching(false)
    }
  }

  const selectedIds = new Set(selected.map((c) => c.id))
  const add = (c: CouponSummary) => {
    if (selected.length >= max || selectedIds.has(c.id)) return
    onChange([...selected, c])
  }

  return (
    <div className="coupon-picker">
      {selected.length > 0 && (
        <ul className="image-list" aria-label={`${label} 목록`}>
          {selected.map((c) => (
            <li key={c.id} className="image-item">
              <span className="image-url" title={c.name}>
                <strong>{c.name}</strong> · {couponLine(c)}
                {!c.active && <span className="status-badge status-badge--cancelled"> 비활성</span>}
              </span>
              <span className="image-actions">
                <button type="button" className="btn btn--danger btn--sm" aria-label={`${c.name} 빼기`} onClick={() => onChange(selected.filter((x) => x.id !== c.id))}>
                  빼기
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="inline-form">
        <input
          type="text"
          aria-label="쿠폰 검색"
          placeholder="쿠폰 이름·코드로 찾기 (비우면 최근 쿠폰)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSearch()
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={onSearch} disabled={searching}>
          쿠폰 찾기
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {results && results.length === 0 && <p className="form-hint">찾은 쿠폰이 없습니다</p>}
      {results && results.length > 0 && (
        <ul className="image-list promotion-search-results" aria-label="쿠폰 검색 결과">
          {results.map((c) => (
            <li key={c.id} className="image-item">
              <span className="image-url" title={c.name}>
                <strong>{c.name}</strong> · {couponLine(c)}
                {!c.active && <span className="status-badge status-badge--cancelled"> 비활성</span>}
              </span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                aria-label={`${c.name} 추가`}
                onClick={() => add(c)}
                disabled={selectedIds.has(c.id) || selected.length >= max}
              >
                {selectedIds.has(c.id) ? '추가됨' : '추가'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
