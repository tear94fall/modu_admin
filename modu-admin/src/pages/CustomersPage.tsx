import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { type AdminCustomer, isAgreed, searchCustomers } from '../api/customers'
import { errorMessage } from '../api/pushCampaigns'
import { getTiers, type TierSummary } from '../api/tiers'
import Pager from '../components/Pager'
import TierBadge from '../components/TierBadge'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'

const AGREED_FILTERS: { label: string; value: boolean | null }[] = [
  { label: '전체', value: null },
  { label: '동의', value: true },
  { label: '동의 전', value: false },
]

const kst = (v: string | null) => formatUtcDateTime(v, 'Asia/Seoul') || '-'

/** 약관 칸: "동의" · "동의 전" · "탈퇴". */
function AgreementCell({ c }: { c: AdminCustomer }) {
  if (c.status === 'WITHDRAWN') return <span className="status-badge status-badge--cancelled">탈퇴</span>
  return isAgreed(c) ? <span className="status-badge status-badge--done">동의</span> : <span className="status-badge">동의 전</span>
}

/** 커머스 > 고객. 약관에 동의했거나 예전 이용 기록으로 등록된 고객. 가입일 최신순. */
export default function CustomersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [tier, setTier] = useState<string | null>(null)
  const [agreed, setAgreed] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [tiers, setTiers] = useState<TierSummary[]>([])
  const [customers, setCustomers] = useState<AdminCustomer[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTiers()
      .then(setTiers)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchCustomers(searchTerm, page, { tier, agreed })
      .then((result) => {
        if (cancelled) return
        setCustomers(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
        setTotalElements(result.totalElements)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, '고객 목록을 불러오지 못했습니다'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, tier, agreed])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (userId: string) => navigate(`/customers/${encodeURIComponent(userId)}`)
  const onRowKey = (e: KeyboardEvent, userId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(userId)
    }
  }

  const filtered = searchTerm !== '' || tier !== null || agreed !== null
  const tierChips: { label: string; value: string | null }[] = [{ label: '전체', value: null }, ...tiers.map((t) => ({ label: t.name, value: t.code }))]

  return (
    <div>
      <h1>고객</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="사용자 ID 검색" placeholder="사용자 ID 앞부분" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>
      <div className="filter-chip-rows">
        <div className="sort-chips" role="group" aria-label="등급">
          {tierChips.map((f) => (
            <button
              key={f.label}
              type="button"
              className={tier === f.value ? 'sort-chip active' : 'sort-chip'}
              aria-pressed={tier === f.value}
              onClick={() => {
                setPage(0)
                setTier(f.value)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-chips" role="group" aria-label="약관 동의">
          {AGREED_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              className={agreed === f.value ? 'sort-chip active' : 'sort-chip'}
              aria-pressed={agreed === f.value}
              onClick={() => {
                setPage(0)
                setAgreed(f.value)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="form-hint">
        기준 금액은 지금 등급을 정한 지난 6개월 배송 완료 금액, 최근 6개월은 이번 달까지의 금액(다음 달 예상 등급의 기준)입니다. 시각은 한국 시간입니다.
      </p>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && customers.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '커머스 고객이 없습니다'}</p>}
      {!loading && !error && customers.length > 0 && <p className="card-muted">{totalElements.toLocaleString('ko-KR')}명</p>}

      {!loading && !error && customers.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {customers.map((c, i) => (
              <li key={c.userId}>
                <button type="button" className="card" onClick={() => open(c.userId)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <span className="card-body">
                    <span className="card-title">{c.name ?? c.userId}</span>
                    <span className="card-line">{c.email ?? '-'}</span>
                    <span className="card-line card-muted">{c.userId}</span>
                    <span className="card-meta">
                      <TierBadge tier={c.tier} />
                      <AgreementCell c={c} />
                      <span className="card-muted">최근 6개월 {formatPrice(c.rollingAmount)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && customers.length > 0 && !isMobile && (
        <>
          <div className="table-scroll">
            <table className="list-table customer-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="num-cell">번호</th>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>사용자 ID</th>
                  <th>등급</th>
                  <th className="amount-cell">기준 금액</th>
                  <th className="amount-cell">최근 6개월</th>
                  <th>가입일</th>
                  <th>약관</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.userId} className="clickable-row" role="button" tabIndex={0} onClick={() => open(c.userId)} onKeyDown={(e) => onRowKey(e, c.userId)}>
                    <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                    <td title={c.name ?? ''}>{c.name ?? '-'}</td>
                    <td title={c.email ?? ''}>{c.email ?? '-'}</td>
                    <td title={c.userId}>{c.userId}</td>
                    <td>
                      <TierBadge tier={c.tier} />
                    </td>
                    <td className="amount-cell">{formatPrice(c.basisAmount)}</td>
                    <td className="amount-cell">{formatPrice(c.rollingAmount)}</td>
                    <td title={kst(c.joinedAt)}>{kst(c.joinedAt).slice(0, 10)}</td>
                    <td>
                      <AgreementCell c={c} />
                    </td>
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
