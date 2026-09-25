import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUtcDateTime, PAGE_SIZE, Pager, useIsMobile } from '@modu/console-core'
import { displayName, MEMBER_SORT_LABELS, searchMembers, type MemberSort, type StaffMemberSummary } from '../api/members'
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

  return (
    <div>
      <h1>회원 조회</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="회원 검색" placeholder="이름·이메일·사용자 ID 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>
      <div className="filter-row">
        <select
          aria-label="정렬"
          value={sort}
          onChange={(e) => {
            setPage(0)
            setSort(e.target.value as MemberSort)
          }}
        >
          {(Object.keys(MEMBER_SORT_LABELS) as MemberSort[]).map((s) => (
            <option key={s} value={s}>
              {MEMBER_SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="form-check">
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
        {!loading && !error && <span className="result-count">{total.toLocaleString('ko-KR')}명</span>}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && members.length === 0 && <p>{searchTerm ? '검색 결과가 없습니다' : staffOnly ? '직원이 없습니다' : '회원이 없습니다'}</p>}

      {!loading && !error && members.length > 0 && isMobile && (
        <ul className="card-list">
          {members.map((m, i) => (
            <li key={m.id}>
              <button type="button" className="card" onClick={() => open(m)}>
                <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                <span className="card-body">
                  <span className="card-title">
                    {displayName(m)} {m.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
                  </span>
                  <span className="card-line">{m.email}</span>
                  {m.permissions.length > 0 && (
                    <span className="card-line">
                      <StaffBadges permissions={m.permissions} />
                    </span>
                  )}
                  <span className="card-line card-muted">가입 {formatUtcDateTime(m.createdDate) || '-'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && members.length > 0 && !isMobile && (
        <table className="list-table">
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
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
                  {displayName(m)} {m.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
                </td>
                <td title={m.email}>{m.email}</td>
                <td title={m.userId}>{m.userId}</td>
                <td>
                  <StaffBadges permissions={m.permissions} empty="-" />
                </td>
                <td>{formatUtcDateTime(m.createdDate) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !error && members.length > 0 && <Pager page={page} totalPages={totalPages} onChange={setPage} />}
    </div>
  )
}
