import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { DEFAULT_MEMBER_SORT, searchMembers, type Member, type MemberSort } from '../api/members'
import Pager from '../components/Pager'
import RemoteImage from '../components/RemoteImage'
import SortChips, { type SortOption } from '../components/SortChips'
import SortableHeader from '../components/SortableHeader'
import { useIsMobile } from '../hooks/useIsMobile'
import StaffBadges from '../components/StaffBadges'
import { formatDateTime } from '../util/format'

/** 폰 카드 목록의 정렬 기준. 표 머리글과 같은 열·같은 기본 방향이다. */
const MEMBER_SORT_OPTIONS: SortOption[] = [
  { label: '이름', field: 'name', defaultDir: 'asc' },
  { label: '이메일', field: 'email', defaultDir: 'asc' },
  { label: '가입일', field: 'createdDate', defaultDir: 'desc' },
]

export default function MembersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<MemberSort>(DEFAULT_MEMBER_SORT)
  const [members, setMembers] = useState<Member[]>([])
  /** 서버가 돌려준 페이지 번호(0-based). 순번은 지금 표에 깔린 데이터 기준으로 매긴다. */
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchMembers(searchTerm, page, sort)
      .then((result) => {
        if (cancelled) return
        setMembers(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
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

  /** 정렬이 바뀌면 지금 보던 페이지 번호는 의미가 없다. 다른 회원들이 그 자리에 온다. */
  const changeSort = (value: string) => {
    setPage(0)
    setSort(value as MemberSort)
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword)
  }

  return (
    <div>
      <h1>회원 관리</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input
            type="text"
            placeholder="이메일/아이디/이름 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && isMobile && (
        <>
          <SortChips options={MEMBER_SORT_OPTIONS} currentSort={sort} onChange={changeSort} />
          <ul className="card-list">
            {members.map((m, i) => (
              <li key={m.id}>
                <button type="button" className="card" onClick={() => navigate(`/members/${m.id}`)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <RemoteImage filename={m.profileImage} alt="" className="avatar avatar--sm" />
                  <span className="card-body">
                    <span className="card-title">{m.username}</span>
                    <span className="card-line">{m.email}</span>
                    <span className="card-line card-muted">{m.userId}</span>
                    <span className="card-meta">
                      <StaffBadges permissions={m.staffPermissions} empty={null} />
                      <span className="card-muted">{formatDateTime(m.createdDate)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && !isMobile && (
        <>
          <table className="list-table">
            {/* 열 너비를 비율로 못 박는다. 안 그러면 페이지마다 내용 길이를 따라 열이 들썩인다. */}
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th aria-label="프로필" />
                <SortableHeader label="이름" field="name" currentSort={sort} defaultDir="asc" onChange={changeSort} />
                <SortableHeader label="이메일" field="email" currentSort={sort} defaultDir="asc" onChange={changeSort} />
                <SortableHeader
                  label="사용자 ID"
                  field="userId"
                  currentSort={sort}
                  defaultDir="asc"
                  onChange={changeSort}
                />
                {/* 직원 권한은 모두 인터널에서 정한다. 회원 테이블의 옛 role 은 콘솔 권한과 상관없어 보여 주지 않는다. */}
                <th>직원</th>
                <SortableHeader
                  label="가입일"
                  field="createdDate"
                  currentSort={sort}
                  defaultDir="desc"
                  onChange={changeSort}
                />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr
                  key={m.id}
                  className="clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/members/${m.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/members/${m.id}`)
                    }
                  }}
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
                  <td title={formatDateTime(m.createdDate)}>{formatDateTime(m.createdDate)}</td>
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
