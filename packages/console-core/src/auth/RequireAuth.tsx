import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { logout as logoutRequest } from './auth'
import { tokenAccount, tokenRoles } from './roles'
import { clearToken, getToken } from './token'

interface RequireAuthProps {
  children: ReactNode
  /** 이 콘솔에 필요한 권한(예: 'ROLE_SYSTEM'). 로그인했지만 없으면 권한 없음 화면을 보인다. */
  role?: string
}

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  if (role && !tokenRoles(token).includes(role)) return <NoPermission token={token} />
  return <>{children}</>
}

/** 로그인은 됐지만 이 콘솔 권한이 없다. 다른 계정으로 바꿀 수 있게 로그아웃을 둔다. */
function NoPermission({ token }: { token: string }) {
  const navigate = useNavigate()
  const roles = tokenRoles(token)
  const account = tokenAccount(token)
  const logout = () => {
    logoutRequest()
      .catch(() => {})
      .finally(() => {
        clearToken()
        navigate('/login')
      })
  }
  return (
    <div className="login-page">
      <div className="form-card login-form">
        <h1>이 콘솔을 쓸 권한이 없습니다</h1>
        <dl className="login-account">
          <dt>계정</dt>
          <dd>{account ?? '-'}</dd>
          <dt>가진 권한</dt>
          <dd>{roles.length > 0 ? roles.join(', ') : '없음'}</dd>
        </dl>
        <p className="form-hint">최상위 관리자에게 이 콘솔 권한을 요청하거나, 다른 계정으로 로그인하세요.</p>
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
