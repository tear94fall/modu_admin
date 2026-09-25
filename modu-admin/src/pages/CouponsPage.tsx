import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import {
  type CouponSummary,
  discountLabel,
  expiryLabel,
  issuePeriodLabel,
  minOrderLabel,
  quantityLabel,
  searchCoupons,
} from '../api/coupons'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'

const ACTIVE_FILTERS: { label: string; value: boolean | null }[] = [
  { label: '전체', value: null },
  { label: '활성', value: true },
  { label: '비활성', value: false },
]

const activeBadge = (active: boolean) => (
  <span className={active ? 'status-badge status-badge--selling' : 'status-badge status-badge--cancelled'}>{active ? '활성' : '비활성'}</span>
)

const downloadableBadge = (downloadable: boolean) => (
  <span className={downloadable ? 'status-badge status-badge--done' : 'status-badge'}>{downloadable ? '노출' : '숨김'}</span>
)

/** 쿠폰 목록. 활성 여부로 거르고 이름·코드로 찾는다. 서버가 최신순으로 준다. */
export default function CouponsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [active, setActive] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [coupons, setCoupons] = useState<CouponSummary[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchCoupons(searchTerm, page, { active })
      .then((result) => {
        if (cancelled) return
        setCoupons(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('쿠폰 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, active])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (id: number) => navigate(`/coupons/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }
  const filtered = searchTerm !== '' || active !== null

  return (
    <div>
      <h1>쿠폰</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="쿠폰 검색" placeholder="이름·코드 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
        <Link to="/coupons/new" className="btn btn--primary">
          새 쿠폰
        </Link>
      </div>
      <div className="sort-chips" role="group" aria-label="활성">
        {ACTIVE_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={active === f.value ? 'sort-chip active' : 'sort-chip'}
            aria-pressed={active === f.value}
            onClick={() => {
              setPage(0)
              setActive(f.value)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && coupons.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '등록된 쿠폰이 없습니다'}</p>}

      {!loading && !error && coupons.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {coupons.map((c, i) => (
              <li key={c.id}>
                <button type="button" className="card" onClick={() => open(c.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <span className="card-body">
                    <span className="card-title">
                      {c.name}
                      {c.code && <span className="coupon-code"> {c.code}</span>}
                    </span>
                    <span className="card-line">
                      {activeBadge(c.active)} 받기 {downloadableBadge(c.downloadable)}
                    </span>
                    <span className="card-line">
                      {discountLabel(c)} · 최소 주문 {minOrderLabel(c.minOrderAmount)} · {c.scopeLabel}
                    </span>
                    <span className="card-line card-muted">
                      발급 {issuePeriodLabel(c)} · 사용 {expiryLabel(c)}
                    </span>
                    <span className="card-line card-muted">{quantityLabel(c)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && coupons.length > 0 && !isMobile && (
        <>
          <div className="table-scroll">
            <table className="list-table coupon-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="num-cell">번호</th>
                  <th>이름</th>
                  <th>코드</th>
                  <th>할인</th>
                  <th>최소 주문</th>
                  <th>적용 범위</th>
                  <th>발급 기간</th>
                  <th>사용 기한</th>
                  <th>발급/사용</th>
                  <th>받기 노출</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c, i) => (
                  <tr key={c.id} className="clickable-row" role="button" tabIndex={0} onClick={() => open(c.id)} onKeyDown={(e) => onRowKey(e, c.id)}>
                    <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                    <td title={c.name}>{c.name}</td>
                    <td>{c.code ? <span className="coupon-code">{c.code}</span> : '-'}</td>
                    <td>{discountLabel(c)}</td>
                    <td>{minOrderLabel(c.minOrderAmount)}</td>
                    <td title={c.scopeLabel}>{c.scopeLabel}</td>
                    <td>{issuePeriodLabel(c)}</td>
                    <td>{expiryLabel(c)}</td>
                    <td>{quantityLabel(c)}</td>
                    <td>{downloadableBadge(c.downloadable)}</td>
                    <td>{activeBadge(c.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
