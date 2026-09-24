import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { Page } from '../api/members'
import {
  adjustPoints,
  formatPoints,
  getAccount,
  getAccountMember,
  getHistory,
  TRANSACTION_TYPE_LABEL,
  type PointAccount,
  type PointMember,
  type PointTransaction,
} from '../api/points'
import Pager from '../components/Pager'
import { formatDateTime } from '../util/format'

/** 한 사용자의 포인트: 잔액, 수동 지급·회수, 원장. 계정이 없는 사용자도 지급하면 그 자리에서 만들어진다. */
export default function PointAccountPage() {
  const { userId = '' } = useParams<{ userId: string }>()
  const [account, setAccount] = useState<PointAccount | null>(null)
  const [member, setMember] = useState<PointMember | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(0)
  const [history, setHistory] = useState<Page<PointTransaction> | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadAccount = useCallback(() => {
    setError(null)
    setMissing(false)
    getAccount(userId)
      .then(setAccount)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setAccount(null)
          setMissing(true)
        } else {
          setError('포인트 계정을 불러오지 못했습니다')
        }
      })
  }, [userId])

  const loadHistory = useCallback(() => {
    setHistoryError(null)
    getHistory(userId, page)
      .then(setHistory)
      .catch(() => setHistoryError('이력을 불러오지 못했습니다'))
  }, [userId, page])

  useEffect(() => {
    loadAccount()
  }, [loadAccount])

  // 계정이 아직 없는 사용자도 누구인지는 보여 준다. 실패해도 화면은 잔액만으로 그린다.
  useEffect(() => {
    let cancelled = false
    getAccountMember(userId)
      .then((m) => {
        if (!cancelled) setMember(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setResult(null)
    setSubmitError(null)
    const value = Number(amount)
    if (!Number.isInteger(value) || value === 0) {
      setSubmitError('0 이 아닌 정수를 입력하세요. 회수는 음수로 넣습니다.')
      return
    }
    setSubmitting(true)
    try {
      const saved = await adjustPoints(userId, { amount: value, memo })
      setResult(`${value > 0 ? '지급' : '회수'} 완료 · 잔액 ${formatPoints(saved.balance)}`)
      setAmount('')
      setMemo('')
      setPage(0)
      loadAccount()
      loadHistory()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError('잔액보다 많이 회수할 수 없습니다')
      } else {
        setSubmitError('처리하지 못했습니다')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link to="/points" className="back-link">
        ← 포인트
      </Link>
      <div className="info-card">
        <h1>{account?.username ?? member?.username ?? '(이름 없음)'}</h1>
        <dl className="detail-grid">
          <dt>이메일</dt>
          <dd>{account?.email ?? member?.email ?? '-'}</dd>
          <dt>잔액</dt>
          <dd>{formatPoints(account?.balance ?? 0)}</dd>
          <dt>계정 생성</dt>
          <dd>{missing ? '아직 없음 (지급하면 만들어집니다)' : formatDateTime(account?.createdDate)}</dd>
          <dt>마지막 변동</dt>
          <dd>{formatDateTime(account?.updatedDate)}</dd>
        </dl>
        {error && <p className="error-text">{error}</p>}
      </div>

      <h2>수동 지급 · 회수</h2>
      <form className="form-card" onSubmit={onSubmit}>
        <div className="form-section">
          <div className="form-field">
            <label htmlFor="amount">포인트</label>
            <input
              id="amount"
              type="number"
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="지급은 양수, 회수는 음수"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="memo">메모</label>
            <input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 런칭 이벤트 보상" required />
            <p className="form-hint">메모는 원장에 그대로 남습니다.</p>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            반영
          </button>
          {result && <span className="result-text">{result}</span>}
          {submitError && <span className="error-text">{submitError}</span>}
        </div>
      </form>

      <h2>이력</h2>
      {historyError && <p className="error-text">{historyError}</p>}
      {history && history.content.length === 0 && <p>아직 이력이 없습니다</p>}
      {history && history.content.length > 0 && (
        <>
          <table className="list-table">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>시각</th>
                <th>종류</th>
                <th>변동</th>
                <th>잔액</th>
                <th>규칙 · 참조</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {history.content.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.createdDate)}</td>
                  <td>{TRANSACTION_TYPE_LABEL[t.type]}</td>
                  <td className={t.amount < 0 ? 'error-text' : undefined}>{t.amount > 0 ? `+${t.amount.toLocaleString('ko-KR')}` : t.amount.toLocaleString('ko-KR')}</td>
                  <td>{t.balanceAfter.toLocaleString('ko-KR')}</td>
                  <td className="card-muted">{[t.ruleCode, t.refId].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="ellipsis">{t.memo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={history.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
