import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { findMemberByUserId } from '../api/members'

/** 옛 커머스 > 고객 목록(/customers). 이제 회원 목록의 커머스 필터다. */
export function CustomersRedirect() {
  return <Navigate to="/members?service=COMMERCE" replace />
}

/**
 * 옛 고객 상세(/customers/:userId). userId 로 회원을 찾아 그 회원 상세의 커머스 탭으로 보낸다.
 * 못 찾거나 실패하면 회원 목록을 그 userId 로 검색해 보여 준다.
 */
export function CustomerDetailRedirect() {
  const { userId = '' } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const fallback = `/members?keyword=${encodeURIComponent(userId)}`
    findMemberByUserId(userId)
      .then((m) => {
        if (!cancelled) navigate(m ? `/members/${m.id}?tab=commerce` : fallback, { replace: true })
      })
      .catch(() => {
        if (!cancelled) navigate(fallback, { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [userId, navigate])

  return <p>불러오는 중...</p>
}
