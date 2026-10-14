import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUtcDateTime, PAGE_SIZE, Pager, Select, STAFF_PERMISSIONS, useIsMobile } from '@modu/console-core'
import { displayName, MEMBER_SORT_LABELS, permissionLabel, searchMembers, type MemberSort, type StaffMemberSummary } from '../api/members'
import MemberAvatar from '../components/MemberAvatar'
import StaffBadges from '../components/StaffBadges'

/** 회원 조회. 이름·이메일·userId 로 찾고, 직원이면 권한을 배지로 보인다. 직원 지정·권한 변경은 상세에서(최상위만) 한다. */
export default function MembersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState<MemberSort>('name,asc')
  const [staffOnly, setStaffOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [members, setMembers] = useState<StaffMemberSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchMembers(searchTerm, page, sort, staffOnly)
      .then((r) => {
        if (cancelled) return
        setMembers(r.content)
        setTotal(r.totalElements)
        setTotalPages(r.totalPages)
        setPageNumber(r.number)
        setLoaded(true)
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
  }, [searchTerm, page, sort, staffOnly])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (m: StaffMemberSummary) => navigate(`/members/${m.id}`)

  const ready = loaded && !error
  const pageStaff = members.filter((m) => m.permissions.length > 0)
  const totalLabel = staffOnly ? '직원' : searchTerm ? '검색 결과' : '전체 회원'
  const emptyText = searchTerm ? '검색 결과가 없습니다' : staffOnly ? '직원이 없습니다' : '회원이 없습니다'

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>회원 조회</h1>
          <p className="page-head-sub">이름·이메일·사용자 ID 로 회원을 찾고 직원 권한을 확인합니다. 직원 지정·권한 변경은 회원 상세에서 최상위 관리자만 할 수 있습니다.</p>
        </div>
      </header>

      {ready && (
        <section className="stat-grid" aria-label="회원 요약">
          <div className="stat-card">
            <div className="stat-card-label">{totalLabel}</div>
            <div className="stat-card-value">
              {total.toLocaleString('ko-KR')}
              <span className="stat-card-unit">명</span>
            </div>
            {searchTerm && <div className="stat-card-sub">“{searchTerm}”</div>}
          </div>
          <div className="stat-card stat-card--info">
            <div className="stat-card-label">이 페이지 직원</div>
            <div className="stat-card-value">
              {pageStaff.length}
              <span className="stat-card-unit">/ {members.length}명</span>
            </div>
            <div className="stat-card-sub">
              {STAFF_PERMISSIONS.map((p) => `${permissionLabel(p)} ${pageStaff.filter((m) => m.permissions.includes(p)).length}`).join(' · ')}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">페이지</div>
            <div className="stat-card-value">
              {pageNumber + 1}
              <span className="stat-card-unit">/ {Math.max(totalPages, 1)}</span>
            </div>
            <div className="stat-card-sub">{MEMBER_SORT_LABELS[sort]}</div>
          </div>
        </section>
      )}

      <section className="section-card" aria-labelledby="members-heading">
        <div className="section-card-head">
          <div>
            <h2 id="members-heading" className="section-card-title">
              회원 목록
            </h2>
            <p className="section-card-hint">{isMobile ? '누르면 회원 상세로 이동합니다' : '행을 누르면 회원 상세(직원 권한)로 이동합니다'}</p>
          </div>
          {ready && <span className="section-card-count">{total.toLocaleString('ko-KR')}명</span>}
        </div>
        <div className="int-toolbar">
          <form className="search-form int-search" onSubmit={onSearch}>
            <input type="text" aria-label="회원 검색" placeholder="이름·이메일·사용자 ID 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <button type="submit" className="btn btn--primary">
              검색
            </button>
          </form>
          <div className="int-toolbar-filters">
            <Select
              aria-label="정렬"
              value={sort}
              onChange={(v) => {
                setPage(0)
                setSort(v as MemberSort)
              }}
              options={(Object.keys(MEMBER_SORT_LABELS) as MemberSort[]).map((s) => ({ value: s, label: MEMBER_SORT_LABELS[s] }))}
            />
            <label className={staffOnly ? 'filter-chip filter-chip--on int-check-chip' : 'filter-chip int-check-chip'}>
              <input
                type="checkbox"
                checked={staffOnly}
                onChange={(e) => {
                  setPage(0)
                  setStaffOnly(e.target.checked)
                }}
              />
              직원만
            </label>
          </div>
        </div>

        {loading && <p className="card-muted int-card-note">불러오는 중...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && members.length === 0 && <p className="card-muted int-card-note">{emptyText}</p>}

        {!loading && !error && members.length > 0 && isMobile && (
          <ul className="card-rows">
            {members.map((m, i) => (
              <li key={m.id} className="int-row-item">
                <button type="button" className="int-row" onClick={() => open(m)}>
                  <MemberAvatar id={m.id} name={displayName(m)} />
                  <span className="int-row-body">
                    <span className="int-row-title">
                      <span className="int-row-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                      <span className="int-name">{displayName(m)}</span>
                      {m.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
                    </span>
                    <span className="int-row-line">{m.email}</span>
                    {m.permissions.length > 0 && (
                      <span className="int-row-line">
                        <StaffBadges permissions={m.permissions} />
                      </span>
                    )}
                    <span className="int-row-line card-muted">가입 {formatUtcDateTime(m.createdDate) || '-'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && members.length > 0 && !isMobile && (
          <div className="card-table-wrap">
            <table className="list-table card-table">
              <colgroup>
                <col style={{ width: '7%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="num-cell">번호</th>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>사용자 ID</th>
                  <th>직원 권한</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className="clickable-row" onClick={() => open(m)}>
                    <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                    <td title={displayName(m)}>
                      <span className="int-person">
                        <MemberAvatar id={m.id} name={displayName(m)} />
                        <span className="int-name">{displayName(m)}</span>
                        {m.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
                      </span>
                    </td>
                    <td title={m.email}>{m.email}</td>
                    <td title={m.userId}>{m.userId}</td>
                    <td className="int-wrap-cell">
                      <StaffBadges permissions={m.permissions} empty="-" />
                    </td>
                    <td>{formatUtcDateTime(m.createdDate) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && members.length > 0 && (
          <div className="int-card-foot">
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </section>
    </div>
  )
}
