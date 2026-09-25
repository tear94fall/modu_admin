import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNotStaffError, loginWithGoogle } from '../api/auth'
import { renderGoogleButton } from '../auth/google'
import { setRefreshToken, setToken } from '../auth/token'

export const NOT_STAFF_MESSAGE = '직원 계정이 아닙니다. 최상위 관리자에게 직원 등록을 요청하세요.'
export const LOGIN_FAILED_MESSAGE = '로그인하지 못했습니다. 잠시 뒤 다시 시도하세요.'
export const GOOGLE_UNAVAILABLE_MESSAGE = 'Google 로그인 버튼을 불러오지 못했습니다. 네트워크를 확인하고 새로고침하세요.'

/** 직원 Google 로그인. 버튼은 Google Identity Services 가 그리고, 받은 ID 토큰을 콘솔 토큰으로 바꾼다. */
export default function LoginPage() {
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const parent = buttonRef.current
    if (!parent) return
    let cancelled = false
    const onCredential = async (idToken: string) => {
      setError(null)
      setSubmitting(true)
      try {
        const { accessToken, refreshToken } = await loginWithGoogle(idToken)
        setToken(accessToken)
        setRefreshToken(refreshToken)
        navigate('/members')
      } catch (e) {
        setError(isNotStaffError(e) ? NOT_STAFF_MESSAGE : LOGIN_FAILED_MESSAGE)
      } finally {
        setSubmitting(false)
      }
    }
    renderGoogleButton(parent, (idToken) => void onCredential(idToken)).catch(() => {
      if (!cancelled) setError(GOOGLE_UNAVAILABLE_MESSAGE)
    })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="login-page">
      <div className="form-card login-form">
        <h1>관리자 로그인</h1>
        <p className="form-hint">직원으로 등록된 Google 계정으로 로그인합니다.</p>
        <div className="google-button" ref={buttonRef} aria-busy={submitting} />
        {submitting && <p className="form-hint">로그인하는 중...</p>}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
