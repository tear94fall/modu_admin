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

/** 원장 종류 알약 색: 적립·환불은 초록, 사용은 빨강, 조정은 파랑. */
const TYPE_BADGE: Record<PointTransaction['type'], string> = {
  EARN: 'status-badge--done',
  REFUND: 'status-badge--done',
  SPEND: 'status-badge--cancelled',
  ADJUST: 'status-badge--selling',
}

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

  const name = account?.username ?? member?.username ?? '(이름 없음)'
  const email = account?.email ?? member?.email ?? null

  return (
    <div>
      <Link to="/points" className="back-link">
        ← 포인트
      </Link>

      <div className="detail-layout">
        <aside className="member-profile summary-card" aria-label="포인트 계정">
          <div className="member-profile-cover member-profile-cover--empty" />
          <div className="member-profile-head">
            <div className="avatar avatar-placeholder member-profile-avatar">{name.charAt(0)}</div>
            <div className="member-profile-name">
              <h1 className="profile-username">{name}</h1>
            </div>
            {email && <p className="member-profile-email">{email}</p>}
          </div>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">포인트 잔액</h2>
            <div className="summary-figure">
              <span className="summary-figure-value">{formatPoints(account?.balance ?? 0)}</span>
            </div>
          </div>

          <dl className="member-profile-facts">
            <dt>계정 생성</dt>
            <dd>{missing ? '아직 없음 (지급하면 만들어집니다)' : formatDateTime(account?.createdDate)}</dd>
            <dt>마지막 변동</dt>
            <dd>{formatDateTime(account?.updatedDate) || '-'}</dd>
          </dl>
          {error && <p className="error-text member-profile-section">{error}</p>}
        </aside>

        <div className="detail-main">
          <form className="section-card" onSubmit={onSubmit} aria-label="수동 지급 · 회수">
            <div className="section-card-head">
              <div>
                <h2 className="section-card-title">수동 지급 · 회수</h2>
                <p className="section-card-hint">지급은 양수, 회수는 음수로 넣습니다. 메모는 원장에 그대로 남습니다.</p>
              </div>
            </div>
            <div className="point-adjust-row">
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
              <div className="form-field point-adjust-memo">
                <label htmlFor="memo">메모</label>
                <input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 런칭 이벤트 보상" required />
              </div>
              <button type="submit" className="btn btn--primary point-adjust-submit" disabled={submitting}>
                반영
              </button>
            </div>
            {result && <p className="result-text">{result}</p>}
            {submitError && <p className="error-text">{submitError}</p>}
          </form>

          <section className="section-card" aria-label="이력">
            <div className="section-card-head">
              <h2 className="section-card-title">이력</h2>
              {history && <span className="section-card-count">{history.totalElements.toLocaleString('ko-KR')}건</span>}
            </div>
            {historyError && <p className="error-text">{historyError}</p>}
            {history && history.content.length === 0 && <p className="card-muted">아직 이력이 없습니다</p>}
            {history && history.content.length > 0 && (
              <>
                <div className="card-table-wrap">
                  <table className="list-table card-table">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '21%' }} />
                      <col style={{ width: '29%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>종류</th>
                        <th className="amount-cell">변동</th>
                        <th className="amount-cell">잔액</th>
                        <th>규칙 · 참조</th>
                        <th>메모</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.content.map((t) => (
                        <tr key={t.id}>
                          <td>{formatDateTime(t.createdDate)}</td>
                          <td>
                            <span className={`status-badge ${TYPE_BADGE[t.type]}`}>{TRANSACTION_TYPE_LABEL[t.type]}</span>
                          </td>
                          <td className={t.amount < 0 ? 'amount-cell point-amount point-amount--minus' : 'amount-cell point-amount point-amount--plus'}>
                            {t.amount > 0 ? `+${t.amount.toLocaleString('ko-KR')}` : t.amount.toLocaleString('ko-KR')}
                          </td>
                          <td className="amount-cell">{t.balanceAfter.toLocaleString('ko-KR')}</td>
                          <td className="card-muted" title={[t.ruleCode, t.refId].filter(Boolean).join(' · ') || undefined}>
                            {[t.ruleCode, t.refId].filter(Boolean).join(' · ') || '-'}
                          </td>
                          <td title={t.memo ?? undefined}>{t.memo ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={page} totalPages={history.totalPages} onChange={setPage} />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
