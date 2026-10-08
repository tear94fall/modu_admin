import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  AD_PREFIX,
  type AdminPushCampaign,
  cancelPushCampaign,
  errorMessage,
  getPushCampaign,
  OPT_OUT_SUFFIX,
  openRate,
  PUSH_STATUS_LABELS,
  pushStatusClass,
  targetText,
} from '../api/pushCampaigns'
import CopyButton from '../components/CopyButton'
import { PushFunnelSteps } from '../components/PushFunnel'
import { NotificationPreview } from './PushCampaignFormPage'
import { formatUtcDateTime } from '../util/timeZone'

const kst = (v: string | null) => formatUtcDateTime(v, 'Asia/Seoul') || '-'
const num = (n: number) => n.toLocaleString('ko-KR')

/** /push-campaigns/:id. 보낸 내용·대상·시각·결과. 예약이면 취소, 언제든 복제해서 새로 만들 수 있다. */
export default function PushCampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<AdminPushCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getPushCampaign(id)
      .then((c) => {
        if (!cancelled) setCampaign(c)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError(errorMessage(err, '푸시 캠페인을 불러오지 못했습니다'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // "지금 보내기" 직후엔 서버가 따로 보내는 중이다. 끝날 때까지 2초마다 다시 읽는다.
  const sending = campaign?.status === 'SENDING'
  useEffect(() => {
    if (!id || !sending) return
    const timer = setInterval(() => {
      getPushCampaign(id)
        .then(setCampaign)
        .catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [id, sending])

  const onCancel = async () => {
    if (!campaign) return
    setCanceling(true)
    setError(null)
    try {
      setCampaign(await cancelPushCampaign(campaign.id))
      setConfirmingCancel(false)
    } catch (err) {
      setError(errorMessage(err, '예약을 취소하지 못했습니다'))
    } finally {
      setCanceling(false)
    }
  }

  const backLink = (
    <Link to="/push-campaigns" className="back-link">
      ← 푸시 캠페인 목록
    </Link>
  )

  if (loading) return <p>불러오는 중...</p>
  if (notFound || !campaign)
    return (
      <div>
        {backLink}
        {loadError ? <p className="error-text">{loadError}</p> : <p>푸시 캠페인을 찾을 수 없습니다</p>}
      </div>
    )

  const c = campaign
  const sent = c.status === 'SENT' || c.status === 'SENDING' || c.status === 'FAILED'

  return (
    <div>
      {backLink}
      <div className="detail-layout">
        <aside className="member-profile summary-card" aria-label="캠페인 정보">
          <div className="member-profile-cover member-profile-cover--empty" />
          <div className="member-profile-head">
            <span className="summary-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" />
                <path d="M10 20.5a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <div className="member-profile-name">
              <h1 className="profile-username">{c.title}</h1>
              <span className={pushStatusClass(c.status)}>{PUSH_STATUS_LABELS[c.status]}</span>
            </div>
          </div>

          <dl className="member-profile-facts">
            <dt>캠페인 ID</dt>
            <dd className="member-profile-id">
              <code>{c.id}</code>
              <CopyButton text={String(c.id)} label="캠페인 ID 복사" />
            </dd>
            <dt>만든 사람</dt>
            <dd>{c.createdBy ?? '-'}</dd>
            <dt>야간 발송</dt>
            <dd>{c.nightApplied ? '예 — 야간 수신 동의자에게만 보냄' : '아니요'}</dd>
          </dl>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">시각 (한국 시간)</h2>
            <dl className="member-profile-facts summary-facts-flush">
              <dt>예약 시각</dt>
              <dd>{kst(c.scheduledAt)}</dd>
              <dt>보낸 시각</dt>
              <dd>{kst(c.sentAt)}</dd>
              {c.canceledAt && (
                <>
                  <dt>취소 시각</dt>
                  <dd>{kst(c.canceledAt)}</dd>
                </>
              )}
              <dt>만든 시각</dt>
              <dd>{kst(c.createdAt)}</dd>
              {c.failureMessage && (
                <>
                  <dt>실패 이유</dt>
                  <dd className="error-text push-failure">{c.failureMessage}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">관리</h2>
            <div className="summary-actions">
              <button type="button" className="btn btn--secondary" onClick={() => navigate(`/push-campaigns/new?copy=${c.id}`)}>
                복제해서 새로 만들기
              </button>
              {c.status === 'SCHEDULED' && !confirmingCancel && (
                <button type="button" className="btn btn--danger" onClick={() => setConfirmingCancel(true)}>
                  예약 취소
                </button>
              )}
              {c.status === 'SCHEDULED' && confirmingCancel && (
                <span className="confirm-inline" role="group" aria-label="예약 취소 확인">
                  <span>{kst(c.scheduledAt)} 예약을 취소할까요?</span>
                  <button type="button" className="btn btn--danger" onClick={onCancel} disabled={canceling}>
                    취소 확인
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmingCancel(false)} disabled={canceling}>
                    아니요
                  </button>
                </span>
              )}
            </div>
            {error && <p className="error-text">{error}</p>}
          </div>
        </aside>

        <div className="detail-main">
          {sent && (
            <section className="stat-grid" aria-label="결과">
              <div className="stat-card">
                <span className="stat-card-label">보낸 기기</span>
                <strong className="stat-card-value">{num(c.targetDevices)}</strong>
                <span className="stat-card-sub">회원 {num(c.targetUsers)}명</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">성공</span>
                <strong className="stat-card-value">{num(c.successCount)}</strong>
                <span className="stat-card-sub">실패 {num(c.failureCount)}</span>
              </div>
              <div className="stat-card stat-card--accent">
                <span className="stat-card-label">열어 봄</span>
                <strong className="stat-card-value">{num(c.openedCount)}</strong>
                <span className="stat-card-sub">성공 대비 {openRate(c)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">정리한 토큰</span>
                <strong className="stat-card-value">{num(c.removedTokens)}</strong>
                <span className="stat-card-sub">만료·삭제된 기기</span>
              </div>
            </section>
          )}
          {sent && (
            <section className="section-card" aria-label="발송 결과">
              <div className="section-card-head">
                <h2 className="section-card-title">보냄 → 성공 → 열어 봄</h2>
              </div>
              <PushFunnelSteps c={c} />
            </section>
          )}

          <section className="section-card section-card--container" aria-label="내용">
            <div className="section-card-head">
              <h2 className="section-card-title">내용</h2>
            </div>
            <div className="push-content-grid">
              <dl className="kv-grid">
                <dt>제목</dt>
                <dd>
                  {AD_PREFIX}
                  {c.title}
                </dd>
                <dt>내용</dt>
                <dd className="push-detail-body">
                  {c.body}
                  {OPT_OUT_SUFFIX}
                </dd>
                <dt>이미지</dt>
                <dd>
                  {c.imageUrl ? (
                    <a href={c.imageUrl} target="_blank" rel="noreferrer">
                      {c.imageUrl}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
                <dt>누르면 열 화면</dt>
                <dd>
                  {targetText(c)} <span className="card-muted">({c.path})</span>
                </dd>
              </dl>
              <NotificationPreview title={c.title} body={c.body} imageUrl={c.imageUrl ?? ''} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
