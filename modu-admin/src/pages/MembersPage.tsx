import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { type AdminCustomer, type CustomerLookup, isAgreed, lookupCustomers, searchCustomers } from '../api/customers'
import {
  DEFAULT_MEMBER_SORT,
  findMemberByUserId,
  type Member,
  type MemberSort,
  SERVICE_FILTERS,
  type ServiceFilter,
  searchMembers,
} from '../api/members'
import { getTiers, type TierSummary } from '../api/tiers'
import Pager from '../components/Pager'
import RemoteImage from '../components/RemoteImage'
import ServiceBadges from '../components/ServiceBadges'
import SortChips, { type SortOption } from '../components/SortChips'
import SortableHeader from '../components/SortableHeader'
import StaffBadges from '../components/StaffBadges'
import { CommerceBadge } from '../components/TierBadge'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'

/** 폰 카드 목록의 정렬 기준. 표 머리글과 같은 열·같은 기본 방향이다. */
const MEMBER_SORT_OPTIONS: SortOption[] = [
  { label: '이름', field: 'name', defaultDir: 'asc' },
  { label: '이메일', field: 'email', defaultDir: 'asc' },
  { label: '가입일', field: 'createdDate', defaultDir: 'desc' },
]

/** 서비스 칩. null = 전체. */
const SERVICE_CHIPS: { label: string; value: ServiceFilter | null }[] = [
  { label: '전체', value: null },
  { label: '채팅', value: 'CHAT' },
  { label: '커머스', value: 'COMMERCE' },
  { label: '둘 다', value: 'BOTH' },
]

const AGREED_CHIPS: { label: string; value: boolean | null }[] = [
  { label: '전체', value: null },
  { label: '동의', value: true },
  { label: '동의 전', value: false },
]

const kst = (v: string | null) => formatUtcDateTime(v, 'Asia/Seoul') || '-'

const parseService = (v: string | null): ServiceFilter | null => (v && (SERVICE_FILTERS as readonly string[]).includes(v) ? (v as ServiceFilter) : null)
const parseAgreed = (v: string | null): boolean | null => (v === 'true' ? true : v === 'false' ? false : null)

/** 커머스 고객 목록 줄의 배지 모양(목록 조회 결과를 lookup 모양으로). */
const toLookup = (c: AdminCustomer): CustomerLookup => ({ userId: c.userId, status: c.status, tier: c.tier, agreed: isAgreed(c) })

/**
 * 회원 목록. 서비스 칩(전체/채팅/커머스/둘 다)은 URL 의 service 로 남는다.
 * 커머스를 고르면 등급·약관 동의 칩이 더 나오고, 그중 하나라도 켜면 목록은 커머스 고객 목록(가입일 최신순)에서 온다.
 */
export default function MembersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const service = parseService(params.get('service'))
  const tier = service === 'COMMERCE' ? params.get('tier') || null : null
  const agreed = service === 'COMMERCE' ? parseAgreed(params.get('agreed')) : null
  const searchTerm = params.get('keyword') ?? ''
  /** 등급·동의 필터가 켜져 있으면 커머스 고객 목록이 목록을 이끈다. */
  const commerceSource = tier !== null || agreed !== null

  const [keyword, setKeyword] = useState(searchTerm)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<MemberSort>(DEFAULT_MEMBER_SORT)
  const [members, setMembers] = useState<Member[]>([])
  const [commerceRows, setCommerceRows] = useState<AdminCustomer[]>([])
  /** 서버가 돌려준 페이지 번호(0-based). 순번은 지금 표에 깔린 데이터 기준으로 매긴다. */
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** 이 페이지 회원들의 커머스 고객 정보(userId → 등급). 못 읽으면 비워 두고 배지만 빠진다. */
  const [customers, setCustomers] = useState<Map<string, CustomerLookup>>(new Map())
  const [tiers, setTiers] = useState<TierSummary[]>([])

  // 등급 칩은 커머스를 고를 때만 필요하다.
  const commerceSelected = service === 'COMMERCE'
  useEffect(() => {
    if (!commerceSelected || tiers.length > 0) return
    let cancelled = false
    getTiers()
      .then((list) => {
        if (!cancelled) setTiers(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [commerceSelected, tiers.length])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    if (commerceSource) {
      searchCustomers(searchTerm, page, { tier, agreed })
        .then((result) => {
          if (cancelled) return
          setCommerceRows(result.content)
          setPageNumber(result.number)
          setTotalPages(result.totalPages)
        })
        .catch(() => {
          if (!cancelled) setError('커머스 고객 목록을 불러오지 못했습니다')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }
    const request = service ? searchMembers(searchTerm, page, sort, service) : searchMembers(searchTerm, page, sort)
    request
      .then((result) => {
        if (cancelled) return
        setMembers(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
        setCustomers(new Map())
        // 배지는 곁들이 정보다. 커머스가 꺼져 있거나 실패해도 회원 목록은 그대로 보여 준다.
        lookupCustomers(result.content.map((m) => m.userId))
          .then((found) => {
            if (!cancelled) setCustomers(found)
          })
          .catch(() => {})
      })
      .catch(() => {
        if (!cancelled) setError('회원 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, sort, service, tier, agreed, commerceSource])

  /** URL 필터를 바꾼다. 값이 null 이면 뺀다. 필터가 바뀌면 첫 페이지부터. */
  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setPage(0)
    setParams(next, { replace: true })
  }

  const selectService = (value: ServiceFilter | null) => updateParams({ service: value, tier: null, agreed: null })

  /** 정렬이 바뀌면 지금 보던 페이지 번호는 의미가 없다. 다른 회원들이 그 자리에 온다. */
  const changeSort = (value: string) => {
    setPage(0)
    setSort(value as MemberSort)
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    updateParams({ keyword: keyword.trim() === '' ? null : keyword.trim() })
  }

  const openMember = (id: number) => navigate(`/members/${id}`)
  const onRowKey = (e: KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  /** 커머스 고객 줄은 회원 id 를 모른다. userId 로 회원을 찾아 커머스 탭으로 연다. */
  const openCustomer = (userId: string) => {
    findMemberByUserId(userId)
      .then((m) => navigate(m ? `/members/${m.id}?tab=commerce` : `/members?keyword=${encodeURIComponent(userId)}`))
      .catch(() => setError('회원을 찾지 못했습니다'))
  }

  const tierChips: { label: string; value: string | null }[] = [{ label: '전체', value: null }, ...tiers.map((t) => ({ label: t.name, value: t.code }))]
  const rows = commerceSource ? commerceRows : members

  return (
    <div>
      <h1>회원 관리</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input
            type="text"
            aria-label="회원 검색"
            placeholder={commerceSource ? '사용자 ID 앞부분' : '이메일/아이디/이름 검색'}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>

      <div className="filter-chip-rows">
        <div className="sort-chips" role="group" aria-label="이용 서비스">
          {SERVICE_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className={service === c.value ? 'sort-chip active' : 'sort-chip'}
              aria-pressed={service === c.value}
              onClick={() => selectService(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {commerceSelected && (
          <>
            <div className="sort-chips" role="group" aria-label="등급">
              {tierChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={tier === c.value ? 'sort-chip active' : 'sort-chip'}
                  aria-pressed={tier === c.value}
                  onClick={() => updateParams({ tier: c.value })}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="sort-chips" role="group" aria-label="약관 동의">
              {AGREED_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={agreed === c.value ? 'sort-chip active' : 'sort-chip'}
                  aria-pressed={agreed === c.value}
                  onClick={() => updateParams({ agreed: c.value === null ? null : String(c.value) })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {commerceSource && (
        <p className="form-hint">
          커머스 고객 목록(가입일 최신순)입니다. 검색은 사용자 ID 앞부분으로 합니다. 기준 금액은 지금 등급을 정한 지난 6개월 배송 완료 금액, 최근 6개월은 이번 달까지의 금액입니다. 시각은 한국 시간입니다.
        </p>
      )}

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && rows.length === 0 && commerceSource && <p>검색 결과가 없습니다</p>}

      {!loading && !error && rows.length > 0 && commerceSource && (
        <>
          {isMobile ? (
            <ul className="card-list">
              {commerceRows.map((c, i) => (
                <li key={c.userId}>
                  <button type="button" className="card" onClick={() => openCustomer(c.userId)}>
                    <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                    <span className="card-body">
                      <span className="card-title">{c.name ?? c.userId}</span>
                      <span className="card-line">{c.email ?? '-'}</span>
                      <span className="card-line card-muted">{c.userId}</span>
                      <span className="card-meta">
                        <CommerceBadge customer={toLookup(c)} />
                        <span className="card-muted">최근 6개월 {formatPrice(c.rollingAmount)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="table-scroll">
              <table className="list-table customer-table">
                <colgroup>
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="num-cell">번호</th>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>사용자 ID</th>
                    <th>이용 서비스</th>
                    <th className="amount-cell">기준 금액</th>
                    <th className="amount-cell">최근 6개월</th>
                    <th>커머스 가입</th>
                  </tr>
                </thead>
                <tbody>
                  {commerceRows.map((c, i) => (
                    <tr
                      key={c.userId}
                      className="clickable-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => openCustomer(c.userId)}
                      onKeyDown={(e) => onRowKey(e, () => openCustomer(c.userId))}
                    >
                      <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                      <td title={c.name ?? ''}>{c.name ?? '-'}</td>
                      <td title={c.email ?? ''}>{c.email ?? '-'}</td>
                      <td title={c.userId}>{c.userId}</td>
                      <td>
                        <CommerceBadge customer={toLookup(c)} />
                      </td>
                      <td className="amount-cell">{formatPrice(c.basisAmount)}</td>
                      <td className="amount-cell">{formatPrice(c.rollingAmount)}</td>
                      <td title={kst(c.joinedAt)}>{kst(c.joinedAt).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && !commerceSource && isMobile && (
        <>
          <SortChips options={MEMBER_SORT_OPTIONS} currentSort={sort} onChange={changeSort} />
          <ul className="card-list">
            {members.map((m, i) => (
              <li key={m.id}>
                <button type="button" className="card" onClick={() => openMember(m.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <RemoteImage filename={m.profileImage} alt="" className="avatar avatar--sm" />
                  <span className="card-body">
                    <span className="card-title">{m.username}</span>
                    <span className="card-line">{m.email}</span>
                    <span className="card-line card-muted">{m.userId}</span>
                    <span className="card-meta">
                      <StaffBadges permissions={m.staffPermissions} empty={null} />
                      <ServiceBadges services={m.services} customer={customers.get(m.userId)} empty={null} />
                      <span className="card-muted">{formatUtcDateTime(m.createdDate)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && !commerceSource && !isMobile && (
        <>
          <table className="list-table">
            {/* 열 너비를 비율로 못 박는다. 안 그러면 페이지마다 내용 길이를 따라 열이 들썩인다. */}
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th aria-label="프로필" />
                <SortableHeader label="이름" field="name" currentSort={sort} defaultDir="asc" onChange={changeSort} />
                <SortableHeader label="이메일" field="email" currentSort={sort} defaultDir="asc" onChange={changeSort} />
                <SortableHeader label="사용자 ID" field="userId" currentSort={sort} defaultDir="asc" onChange={changeSort} />
                {/* 직원 권한은 모두 인터널에서 정한다. 회원 테이블의 옛 role 은 콘솔 권한과 상관없어 보여 주지 않는다. */}
                <th>직원</th>
                {/* 채팅(무채색) · 커머스(등급 색). 아무것도 안 쓰면 '-'. */}
                <th>이용 서비스</th>
                <SortableHeader label="가입일" field="createdDate" currentSort={sort} defaultDir="desc" onChange={changeSort} />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr
                  key={m.id}
                  className="clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => openMember(m.id)}
                  onKeyDown={(e) => onRowKey(e, () => openMember(m.id))}
                >
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td className="avatar-cell">
                    <RemoteImage filename={m.profileImage} alt={m.username} className="avatar avatar--sm" />
                  </td>
                  {/* 열이 고정폭이라 긴 값은 잘린다. title 로 전체 값을 남겨 둬야 마우스를 올려 읽을 수 있다. */}
                  <td title={m.username}>{m.username}</td>
                  <td title={m.email}>{m.email}</td>
                  <td title={m.userId}>{m.userId}</td>
                  <td>
                    <StaffBadges permissions={m.staffPermissions} />
                  </td>
                  <td>
                    <ServiceBadges services={m.services} customer={customers.get(m.userId)} />
                  </td>
                  <td title={formatUtcDateTime(m.createdDate)}>{formatUtcDateTime(m.createdDate)}</td>
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
