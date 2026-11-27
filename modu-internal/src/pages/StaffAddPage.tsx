import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasRole, useIsMobile } from '@modu/console-core'
import { displayName, searchMembers, type StaffInfo, type StaffMemberSummary } from '../api/members'
import MemberAvatar from '../components/MemberAvatar'
import StaffBadges from '../components/StaffBadges'
import StaffPermissionCard from '../components/StaffPermissionCard'

/**
 * 직원 추가(최상위만). 이름·이메일·사용자 ID 로 회원을 찾아 고르면 아래에 권한 카드가 열리고, 지정하면 직원 상세로 간다.
 * 이미 직원인 회원은 권한 배지와 함께 보이고 상세로 이어진다.
 */
export default function StaffAddPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const isSuper = hasRole('ROLE_SUPER')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<StaffMemberSummary[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<StaffMemberSummary | null>(null)

  const back = (
    <Link to="/staff" className="back-link">
      ← 직원 목록
    </Link>
  )
  if (!isSuper)
    return (
      <div>
        {back}
        <p className="error-text">직원 지정은 최상위 관리자만 할 수 있습니다</p>
      </div>
    )

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const term = keyword.trim()
    if (!term) return
    setLoading(true)
    setError(null)
    setPicked(null)
    searchMembers(term, 0)
      .then((r) => setResults(r.content))
      .catch(() => setError('회원을 찾지 못했습니다'))
      .finally(() => setLoading(false))
  }

  const pick = (m: StaffMemberSummary) => {
    if (m.permissions.length > 0) navigate(`/staff/${m.id}`)
    else setPicked(m)
  }

  /** 지정이 끝나면 직원 상세로. 카드가 null 을 주는 일(해제)은 새 직원에겐 없다. */
  const onDesignated = (staff: StaffInfo | null) => {
    if (staff && picked) navigate(`/staff/${picked.id}`)
  }

  const rowOf = (m: StaffMemberSummary) => (
    <button type="button" className="int-row" onClick={() => pick(m)} aria-pressed={picked?.id === m.id}>
      <MemberAvatar id={m.id} name={displayName(m)} />
      <span className="int-row-body">
        <span className="int-row-title">
          <span className="int-name">{displayName(m)}</span>
          {m.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
        </span>
        <span className="int-row-line">{m.email}</span>
        {m.permissions.length > 0 && (
          <span className="int-row-line">
            <StaffBadges permissions={m.permissions} />
          </span>
        )}
      </span>
    </button>
  )

  return (
    <div>
      {back}
      <header className="page-head">
        <div className="page-head-main">
          <h1>직원 추가</h1>
          <p className="page-head-sub">이름·이메일·사용자 ID 로 회원을 찾아 고르면 권한을 정할 수 있습니다. 이미 직원이면 직원 상세로 이어집니다.</p>
        </div>
      </header>

      <section className="section-card" aria-labelledby="staff-find-heading">
        <div className="section-card-head">
          <h2 id="staff-find-heading" className="section-card-title">
            회원 찾기
          </h2>
        </div>
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="회원 검색" placeholder="이름·이메일·사용자 ID 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary" disabled={loading}>
            검색
          </button>
        </form>
        {loading && <p className="card-muted int-card-note">찾는 중...</p>}
        {error && <p className="error-text">{error}</p>}
        {results && results.length === 0 && <p className="card-muted int-card-note">검색 결과가 없습니다</p>}
        {results && results.length > 0 && (
          <ul className="card-rows" aria-label="검색 결과">
            {results.map((m) => (
              <li key={m.id} className="int-row-item">
                {rowOf(m)}
              </li>
            ))}
          </ul>
        )}
        {!isMobile && results && results.length > 0 && <p className="section-card-hint">회원을 누르면 아래에 권한 카드가 열립니다</p>}
      </section>

      {picked && (
        <StaffPermissionCard
          key={picked.id}
          memberId={picked.id}
          memberName={displayName(picked)}
          memberEmail={picked.email}
          staff={null}
          withdrawn={picked.status === 'WITHDRAWN'}
          editable
          onChange={onDesignated}
        />
      )}
    </div>
  )
}
