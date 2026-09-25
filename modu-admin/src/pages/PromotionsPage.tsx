import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import {
  DEFAULT_BANNER_COLOR,
  formatPeriod,
  PROMOTION_STATUS_LABELS,
  type PromotionSummary,
  type PromotionType,
  promotionStatusClass,
  searchPromotions,
  TYPE_LABELS,
} from '../api/promotions'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'

const TYPE_FILTERS: { label: string; value: PromotionType | null }[] = [
  { label: '전체', value: null },
  { label: '기획전', value: 'EXHIBITION' },
  { label: '이벤트', value: 'EVENT' },
]

/** 배너 썸네일. 이미지가 있으면 이미지, 없으면 배너 색 견본. */
function BannerThumb({ p }: { p: PromotionSummary }) {
  if (p.bannerImageUrl) return <img src={p.bannerImageUrl} alt="" className="promotion-thumb" style={{ background: p.bannerColor ?? DEFAULT_BANNER_COLOR }} />
  return <span className="promotion-thumb" data-testid="banner-swatch" style={{ background: p.bannerColor ?? DEFAULT_BANNER_COLOR }} />
}

/** 기획전은 상품 수, 이벤트는 출석 수. */
const countText = (p: PromotionSummary) => (p.type === 'EXHIBITION' ? `상품 ${p.productCount}개` : `출석 ${p.attendanceCount}회`)

/** 기획전·이벤트 목록. 종류로 거르고 제목으로 찾는다. 서버가 순서(sortOrder) 오름차순, 최신순으로 준다. */
export default function PromotionsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [type, setType] = useState<PromotionType | null>(null)
  const [page, setPage] = useState(0)
  const [promotions, setPromotions] = useState<PromotionSummary[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchPromotions(searchTerm, page, { type })
      .then((result) => {
        if (cancelled) return
        setPromotions(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('기획전·이벤트 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, type])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (id: number) => navigate(`/promotions/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }
  const filtered = searchTerm !== '' || type !== null
  const visibleBadge = (visible: boolean) => (
    <span className={visible ? 'status-badge status-badge--selling' : 'status-badge'}>{visible ? '노출' : '숨김'}</span>
  )

  return (
    <div>
      <h1>기획전·이벤트</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="제목 검색" placeholder="제목 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
        <Link to="/promotions/new" className="btn btn--primary">
          새로 만들기
        </Link>
      </div>
      <div className="sort-chips" role="group" aria-label="종류">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={type === f.value ? 'sort-chip active' : 'sort-chip'}
            aria-pressed={type === f.value}
            onClick={() => {
              setPage(0)
              setType(f.value)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && promotions.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '등록된 기획전·이벤트가 없습니다'}</p>}

      {!loading && !error && promotions.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {promotions.map((p, i) => (
              <li key={p.id}>
                <button type="button" className="card" onClick={() => open(p.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <BannerThumb p={p} />
                  <span className="card-body">
                    <span className="card-title">
                      [{TYPE_LABELS[p.type]}] {p.title}
                    </span>
                    <span className="card-line">
                      <span className={promotionStatusClass(p.status)}>{PROMOTION_STATUS_LABELS[p.status]}</span> {visibleBadge(p.visible)}
                    </span>
                    <span className="card-line card-muted">{formatPeriod(p.startDate, p.endDate)}</span>
                    <span className="card-line card-muted">
                      순서 {p.sortOrder} · {countText(p)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && promotions.length > 0 && !isMobile && (
        <>
          <table className="list-table">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th aria-label="배너" />
                <th>종류</th>
                <th>제목</th>
                <th>기간</th>
                <th>상태</th>
                <th>노출</th>
                <th>순서</th>
                <th>상품·출석</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p, i) => (
                <tr key={p.id} className="clickable-row" role="button" tabIndex={0} onClick={() => open(p.id)} onKeyDown={(e) => onRowKey(e, p.id)}>
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td>
                    <BannerThumb p={p} />
                  </td>
                  <td>{TYPE_LABELS[p.type]}</td>
                  <td title={p.title}>{p.title}</td>
                  <td>{formatPeriod(p.startDate, p.endDate)}</td>
                  <td>
                    <span className={promotionStatusClass(p.status)}>{PROMOTION_STATUS_LABELS[p.status]}</span>
                  </td>
                  <td>{visibleBadge(p.visible)}</td>
                  <td>{p.sortOrder}</td>
                  <td>{countText(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
