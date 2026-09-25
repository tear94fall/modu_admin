import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUtcDateTime, PAGE_SIZE, Pager, useIsMobile } from '@modu/console-core'
import { MEMBER_SORT_LABELS, roleLabel, searchMembers, type Member, type MemberSort } from '../api/members'

/** 회원 조회(읽기 전용). 이름·이메일·userId 로 찾고 상세를 연다. 직원 여부 설정은 이 화면에 붙일 예정이다. */
export default function MembersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState<MemberSort>('name,asc')
  const [page, setPage] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchMembers(searchTerm, page, sort)
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
  }, [searchTerm, page, sort])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (m: Member) => navigate(`/members/${m.id}`)

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
        {!loading && !error && <span className="result-count">{total.toLocaleString('ko-KR')}명</span>}
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && members.length === 0 && <p>{searchTerm ? '검색 결과가 없습니다' : '회원이 없습니다'}</p>}

      {!loading && !error && members.length > 0 && isMobile && (
        <ul className="card-list">
          {members.map((m, i) => (
            <li key={m.id}>
              <button type="button" className="card" onClick={() => open(m)}>
                <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                <span className="card-body">
                  <span className="card-title">{m.username}</span>
                  <span className="card-line">{m.email}</span>
                  <span className="card-line card-muted">
                    {roleLabel(m.role)} · 가입 {formatUtcDateTime(m.createdDate) || '-'}
                  </span>
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
            <col style={{ width: '18%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="num-cell">번호</th>
              <th>이름</th>
              <th>이메일</th>
              <th>사용자 ID</th>
              <th>구분</th>
              <th>가입일</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className="clickable-row" onClick={() => open(m)}>
                <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                <td title={m.username}>{m.username}</td>
                <td title={m.email}>{m.email}</td>
                <td title={m.userId}>{m.userId}</td>
                <td>{roleLabel(m.role)}</td>
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
