import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { type Member, searchMembers } from '../api/members'
import { searchProducts, STATUS_LABELS, type ProductStatus } from '../api/products'
import { PROMOTION_STATUS_LABELS, type PromotionSummary, promotionKindLabel, promotionStatusClass, searchPromotions } from '../api/promotions'
import {
  AD_PREFIX,
  createPushCampaign,
  errorMessage,
  getPushAudience,
  getPushCampaign,
  kstIso,
  MAX_BODY,
  MAX_SCHEDULE_DAYS,
  MAX_TEST_USERS,
  MAX_TITLE,
  nextKstSlot,
  OPT_OUT_SUFFIX,
  type PushAudience,
  type PushCampaignRequest,
  type PushTargetType,
  type PushTestResult,
  scheduleProblem,
  sendPushTest,
  TARGET_CHIP_LABELS,
  validatePushCampaign,
} from '../api/pushCampaigns'
import DateField from '../components/DateField'
import { addDays, pad, todayKst } from '../util/dateInput'
import { formatPrice } from '../util/format'
import Select from '../components/Select'

const TARGETS: PushTargetType[] = ['PRODUCT', 'PROMOTION', 'COUPONS', 'HOME']
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = [0, 10, 20, 30, 40, 50]

interface PickedProduct {
  id: number
  name: string
  imageUrl: string | null
  price: number
  status: ProductStatus
}

interface PickedPromotion {
  id: number
  title: string
}

type SendMode = 'NOW' | 'SCHEDULED'

/** 앱이 받는 알림 모양. 제목·내용에 서버가 붙이는 광고 표시·수신거부 안내까지 넣어 보여 준다. */
export function NotificationPreview({ title, body, imageUrl }: { title: string; body: string; imageUrl: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <div className="push-phone" data-testid="push-preview" aria-label="알림 미리보기">
      <div className="push-phone-bar">
        <span>9:41</span>
        <span className="push-phone-icons" aria-hidden="true">
          {/* 신호: 높이가 다른 막대 네 개 */}
          <svg viewBox="0 0 18 12" width="18" height="12">
            <rect x="0" y="8" width="3" height="4" rx="0.8" fill="currentColor" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="currentColor" />
            <rect x="10" y="3" width="3" height="9" rx="0.8" fill="currentColor" />
            <rect x="15" y="0" width="3" height="12" rx="0.8" fill="currentColor" />
          </svg>
          {/* 와이파이: 부채꼴 호 두 개 + 점 */}
          <svg viewBox="0 0 16 12" width="16" height="12">
            <path d="M1 4.2a10 10 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M3.9 7.1a5.8 5.8 0 0 1 8.2 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="8" cy="10.3" r="1.5" fill="currentColor" />
          </svg>
          {/* 배터리: 테두리 + 채운 칸 + 단자 */}
          <svg viewBox="0 0 26 12" width="26" height="12">
            <rect x="0.75" y="0.75" width="21.5" height="10.5" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
            <rect x="2.5" y="2.5" width="15" height="7" rx="1.6" fill="currentColor" />
            <rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.55" />
          </svg>
        </span>
      </div>
      <div className="push-notification">
        <div className="push-notification-app">
          <img src="/favicon.svg" alt="" className="push-notification-icon" />
          <span>모두의 커머스</span>
          <span className="push-notification-time">· 지금</span>
        </div>
        <strong className="push-notification-title">
          {AD_PREFIX}
          {title || '제목'}
        </strong>
        <p className="push-notification-body">
          {body || '내용'}
          {OPT_OUT_SUFFIX}
        </p>
        {imageUrl && failed !== imageUrl && <img src={imageUrl} alt="알림 이미지 미리보기" className="push-notification-image" onError={() => setFailed(imageUrl)} />}
        {imageUrl && failed === imageUrl && <p className="form-warning">이미지를 불러오지 못했습니다. URL 을 확인하세요.</p>}
      </div>
      <p className="form-hint push-phone-note">(광고) 표시와 수신거부 안내는 서버가 붙입니다.</p>
    </div>
  )
}

/** 테스트 보내기. 회원을 찾아 5명까지 골라 동의와 상관없이 바로 보낸다(캠페인으로 남지 않는다). */
function TestSendPanel({ build }: { build: () => { body: Omit<PushCampaignRequest, 'scheduledAt'>; problem: string | null } }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Member[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Member[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<PushTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSearch = async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const page = await searchMembers(keyword.trim(), 0)
      setResults(page.content)
    } catch {
      setSearchError('회원을 찾지 못했습니다')
    } finally {
      setSearching(false)
    }
  }

  const pickedIds = new Set(picked.map((m) => m.userId))
  const pick = (m: Member) => {
    if (picked.length >= MAX_TEST_USERS || pickedIds.has(m.userId)) return
    setPicked([...picked, m])
  }

  const onSend = async () => {
    setError(null)
    setResult(null)
    const { body, problem } = build()
    if (problem) {
      setError(problem)
      return
    }
    setSending(true)
    try {
      setResult(await sendPushTest({ ...body, userIds: picked.map((m) => m.userId) }))
    } catch (err) {
      setError(errorMessage(err, '테스트를 보내지 못했습니다'))
    } finally {
      setSending(false)
    }
  }

  const nameOf = (userId: string) => picked.find((m) => m.userId === userId)?.username

  return (
    <section className="form-section" aria-label="테스트 보내기">
      <h2 className="form-heading">테스트 보내기</h2>
      <p className="form-hint">
        고른 회원의 기기로 지금 보냅니다. 알림 동의와 상관없이 보내고 캠페인으로 남지 않습니다. 제목 앞에 [테스트] 가 붙습니다. {MAX_TEST_USERS}명까지.
      </p>
      <div className="inline-form">
        <input
          type="text"
          aria-label="테스트 회원 검색"
          placeholder="이름·이메일·사용자 ID"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSearch()
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={onSearch} disabled={searching}>
          회원 찾기
        </button>
      </div>
      {searchError && <p className="error-text">{searchError}</p>}
      {results && results.length === 0 && <p className="form-hint">찾은 회원이 없습니다</p>}
      {results && results.length > 0 && (
        <ul className="image-list promotion-search-results" aria-label="테스트 회원 검색 결과">
          {results.map((m) => (
            <li key={m.userId} className="image-item">
              <span className="image-url" title={m.userId}>
                <strong>{m.username}</strong> · {m.email} · <span className="card-muted">{m.userId}</span>
              </span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                aria-label={`${m.username} 선택`}
                onClick={() => pick(m)}
                disabled={pickedIds.has(m.userId) || picked.length >= MAX_TEST_USERS}
              >
                {pickedIds.has(m.userId) ? '선택됨' : '선택'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked.length > 0 && (
        <ul className="grant-chips" aria-label="테스트 받을 회원">
          {picked.map((m) => (
            <li key={m.userId} className="grant-chip">
              <span title={m.userId}>{m.username}</span>
              <button type="button" aria-label={`${m.username} 빼기`} onClick={() => setPicked(picked.filter((x) => x.userId !== m.userId))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" className="btn btn--secondary" onClick={onSend} disabled={sending || picked.length === 0}>
          {sending ? '보내는 중...' : '테스트 보내기'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <div className="result-text" role="status">
          <p>
            {result.users}명 · 기기 {result.devices}대 중 {result.success}대 성공
            {result.failure > 0 && ` (실패 ${result.failure}대)`}
          </p>
          {result.noDeviceUserIds.length > 0 && (
            <ul className="grant-skipped push-no-device" aria-label="기기 없는 회원">
              {result.noDeviceUserIds.map((userId) => (
                <li key={userId}>
                  {nameOf(userId) ? `${nameOf(userId)} (${userId})` : userId} — 등록된 기기가 없습니다
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * /push-campaigns/new. 커머스 앱에 보낼 광고 푸시를 만든다. ?copy=<id> 면 그 캠페인 내용을 채워 둔다.
 * 지금 보내기는 한 번 더 묻고, 예약은 한국 시간 10분 단위로 30일 안쪽까지.
 */
export default function PushCampaignFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const copyId = params.get('copy')

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<PushTargetType>('PRODUCT')
  const [product, setProduct] = useState<PickedProduct | null>(null)
  const [promotion, setPromotion] = useState<PickedPromotion | null>(null)

  const [mode, setMode] = useState<SendMode>('NOW')
  const [initialSlot] = useState(() => nextKstSlot())
  const [date, setDate] = useState(initialSlot.date)
  const [hour, setHour] = useState(initialSlot.hour)
  const [minute, setMinute] = useState(initialSlot.minute)

  const [productKeyword, setProductKeyword] = useState('')
  const [productResults, setProductResults] = useState<PickedProduct[] | null>(null)
  const [productSearching, setProductSearching] = useState(false)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)

  const [promotionKeyword, setPromotionKeyword] = useState('')
  const [promotionResults, setPromotionResults] = useState<PromotionSummary[] | null>(null)
  const [promotionSearching, setPromotionSearching] = useState(false)
  const [promotionSearchError, setPromotionSearchError] = useState<string | null>(null)

  /** 받는 사람 수와 그 기준 시각(null = 지금). 기준이 지금 폼과 다르면 쓰지 않는다. */
  const [audienceFor, setAudienceFor] = useState<{ at: string | null; data: PushAudience | null; failed: boolean } | null>(null)

  const [copyLoading, setCopyLoading] = useState(copyId !== null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [confirmingNow, setConfirmingNow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 복제: 내용·대상만 가져온다. 보낼 시각은 새로 정한다.
  useEffect(() => {
    if (!copyId) return
    let cancelled = false
    getPushCampaign(copyId)
      .then((c) => {
        if (cancelled) return
        setTitle(c.title)
        setBody(c.body)
        setImageUrl(c.imageUrl ?? '')
        setTargetType(c.targetType)
        if (c.targetType === 'PRODUCT' && c.targetId != null)
          setProduct({ id: c.targetId, name: c.targetLabel ?? `상품 #${c.targetId}`, imageUrl: null, price: 0, status: 'SELLING' })
        if (c.targetType === 'PROMOTION' && c.targetId != null) setPromotion({ id: c.targetId, title: c.targetLabel ?? `기획전 #${c.targetId}` })
      })
      .catch((err) => {
        if (!cancelled) setCopyError(errorMessage(err, '복제할 캠페인을 불러오지 못했습니다'))
      })
      .finally(() => {
        if (!cancelled) setCopyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [copyId])

  const scheduledAt = mode === 'SCHEDULED' && date ? kstIso(date, hour, minute) : null

  // 받는 사람 수: 보낼 시각이 바뀌면 잠깐 기다렸다가 다시 센다.
  useEffect(() => {
    if (mode === 'SCHEDULED' && !scheduledAt) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      getPushAudience(scheduledAt)
        .then((a) => {
          if (!cancelled) setAudienceFor({ at: scheduledAt, data: a, failed: false })
        })
        .catch(() => {
          if (!cancelled) setAudienceFor({ at: scheduledAt, data: null, failed: true })
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mode, scheduledAt])

  const onProductSearch = async () => {
    setProductSearching(true)
    setProductSearchError(null)
    try {
      const result = await searchProducts(productKeyword.trim(), 0)
      setProductResults(result.content.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, status: p.status })))
    } catch (err) {
      setProductSearchError(errorMessage(err, '상품을 찾지 못했습니다'))
    } finally {
      setProductSearching(false)
    }
  }

  const onPromotionSearch = async (keyword: string) => {
    setPromotionSearching(true)
    setPromotionSearchError(null)
    try {
      const result = await searchPromotions(keyword.trim(), 0)
      // 앱에 보이는 것만(서버가 숨김은 거절한다). 끝난 것은 뒤로.
      const visible = result.content.filter((p) => p.visible)
      setPromotionResults([...visible.filter((p) => p.status !== 'ENDED'), ...visible.filter((p) => p.status === 'ENDED')])
    } catch (err) {
      setPromotionSearchError(errorMessage(err, '기획전·이벤트를 찾지 못했습니다'))
    } finally {
      setPromotionSearching(false)
    }
  }

  const buildBody = (): Omit<PushCampaignRequest, 'scheduledAt'> => ({
    title: title.trim(),
    body: body.trim(),
    imageUrl: imageUrl.trim() === '' ? null : imageUrl.trim(),
    targetType,
    targetId: targetType === 'PRODUCT' ? (product?.id ?? null) : targetType === 'PROMOTION' ? (promotion?.id ?? null) : null,
  })

  const buildForTest = () => {
    const b = buildBody()
    return { body: b, problem: validatePushCampaign(b) }
  }

  const schedulePast = scheduledAt ? scheduleProblem(scheduledAt) : null

  const create = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const saved = await createPushCampaign({ ...buildBody(), scheduledAt })
      navigate(`/push-campaigns/${saved.id}`)
    } catch (err) {
      setError(errorMessage(err, '캠페인을 만들지 못했습니다'))
      setSubmitting(false)
      setConfirmingNow(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const invalid = validatePushCampaign(buildBody())
    if (invalid) {
      setError(invalid)
      return
    }
    if (mode === 'SCHEDULED') {
      if (!scheduledAt) {
        setError('예약 날짜를 입력하세요')
        return
      }
      const problem = scheduleProblem(scheduledAt)
      if (problem) {
        setError(problem)
        return
      }
      void create()
      return
    }
    setConfirmingNow(true)
  }

  const current = audienceFor && audienceFor.at === scheduledAt && !(mode === 'SCHEDULED' && !scheduledAt) ? audienceFor : null
  const audience = current?.data ?? null
  const audienceLine = () => {
    if (mode === 'SCHEDULED' && !scheduledAt) return <p className="form-hint">날짜를 고르면 받을 사람 수를 보여 줍니다.</p>
    if (current?.failed) return <p className="form-warning">받을 사람 수를 불러오지 못했습니다.</p>
    if (!audience) return <p className="form-hint">받을 사람 수를 세는 중...</p>
    if (audience.night)
      return (
        <p className="push-audience push-audience--night" role="status">
          야간(21시~08시) 발송이라 야간 수신 동의자 {audience.users.toLocaleString('ko-KR')}명(기기 {audience.devices.toLocaleString('ko-KR')}대)에게만
          발송됩니다
        </p>
      )
    return (
      <p className="push-audience" role="status">
        알림 동의 {audience.users.toLocaleString('ko-KR')}명 · 기기 {audience.devices.toLocaleString('ko-KR')}대
      </p>
    )
  }

  const backLink = (
    <Link to="/push-campaigns" className="back-link">
      ← 푸시 캠페인 목록
    </Link>
  )

  if (copyLoading) return <p>불러오는 중...</p>

  const today = todayKst()

  return (
    <div>
      {backLink}
      <h1>푸시 캠페인 만들기</h1>
      {copyError && <p className="error-text">{copyError}</p>}
      {copyId && !copyError && <p className="form-hint">캠페인 #{copyId} 의 내용을 가져왔습니다. 보낼 시각을 정하세요.</p>}
      <div className="push-layout">
        <form className="form-card form-card--wide push-form" onSubmit={onSubmit} noValidate>
          <div className="form-section">
            <h2 className="form-heading">알림 내용</h2>
            <div className="form-field">
              <label htmlFor="push-title">제목</label>
              <input id="push-title" className="input-lg" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} />
              <span className="push-counter" aria-live="polite">
                {title.length}/{MAX_TITLE}
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="push-body">내용</label>
              <textarea id="push-body" rows={3} maxLength={MAX_BODY} value={body} onChange={(e) => setBody(e.target.value)} />
              <span className="push-counter" aria-live="polite">
                {body.length}/{MAX_BODY}
              </span>
            </div>
            <div className="form-field">
              <label htmlFor="push-image">이미지 URL (선택)</label>
              <input id="push-image" className="input-lg" type="url" placeholder="https://" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <p className="form-hint">알림을 펼치면 큰 이미지로 보입니다.</p>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-heading">누르면 열 화면</h2>
            <div className="sort-chips" role="group" aria-label="대상">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={targetType === t ? 'sort-chip active' : 'sort-chip'}
                  aria-pressed={targetType === t}
                  onClick={() => {
                    setTargetType(t)
                    // 기획전 고르기는 처음부터 최근 목록을 보여 준다.
                    if (t === 'PROMOTION' && promotionResults === null && !promotionSearching) void onPromotionSearch('')
                  }}
                >
                  {TARGET_CHIP_LABELS[t]}
                </button>
              ))}
            </div>

            {targetType === 'PRODUCT' && (
              <div className="form-field">
                {product ? (
                  <div className="image-item push-picked">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                    <span className="image-url" title={product.name}>
                      <strong>{product.name}</strong>
                      {product.price > 0 && ` · ${formatPrice(product.price)}`}
                    </span>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setProduct(null)}>
                      바꾸기
                    </button>
                  </div>
                ) : (
                  <p className="form-hint">판매 중인 상품만 고를 수 있습니다.</p>
                )}
                <div className="inline-form">
                  <input
                    type="text"
                    aria-label="상품 검색"
                    placeholder="상품 이름으로 찾기"
                    value={productKeyword}
                    onChange={(e) => setProductKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void onProductSearch()
                      }
                    }}
                  />
                  <button type="button" className="btn btn--secondary btn--sm" onClick={onProductSearch} disabled={productSearching}>
                    상품 찾기
                  </button>
                </div>
                {productSearchError && <p className="error-text">{productSearchError}</p>}
                {productResults && productResults.length === 0 && <p className="form-hint">찾은 상품이 없습니다</p>}
                {productResults && productResults.length > 0 && (
                  <ul className="image-list promotion-search-results" aria-label="상품 검색 결과">
                    {productResults.map((p) => (
                      <li key={p.id} className="image-item">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                        <span className="image-url" title={p.name}>
                          {p.name} · {formatPrice(p.price)}
                          {p.status !== 'SELLING' && <span className="status-badge status-badge--cancelled"> {STATUS_LABELS[p.status] ?? p.status}</span>}
                        </span>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          aria-label={`${p.name} 고르기`}
                          onClick={() => setProduct(p)}
                          disabled={p.status !== 'SELLING' || product?.id === p.id}
                        >
                          {product?.id === p.id ? '고름' : '고르기'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {targetType === 'PROMOTION' && (
              <div className="form-field">
                {promotion ? (
                  <div className="image-item push-picked">
                    <span className="image-url" title={promotion.title}>
                      <strong>{promotion.title}</strong>
                    </span>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPromotion(null)}>
                      바꾸기
                    </button>
                  </div>
                ) : (
                  <p className="form-hint">앱에 노출된 기획전·이벤트만 고를 수 있습니다.</p>
                )}
                <div className="inline-form">
                  <input
                    type="text"
                    aria-label="기획전 검색"
                    placeholder="제목으로 찾기 (비우면 최근)"
                    value={promotionKeyword}
                    onChange={(e) => setPromotionKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void onPromotionSearch(promotionKeyword)
                      }
                    }}
                  />
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => onPromotionSearch(promotionKeyword)} disabled={promotionSearching}>
                    기획전 찾기
                  </button>
                </div>
                {promotionSearchError && <p className="error-text">{promotionSearchError}</p>}
                {promotionResults && promotionResults.length === 0 && <p className="form-hint">노출 중인 기획전·이벤트가 없습니다</p>}
                {promotionResults && promotionResults.length > 0 && (
                  <ul className="image-list promotion-search-results" aria-label="기획전 검색 결과">
                    {promotionResults.map((p) => (
                      <li key={p.id} className="image-item">
                        <span className="image-url" title={p.title}>
                          [{promotionKindLabel(p)}] {p.title} <span className={promotionStatusClass(p.status)}>{PROMOTION_STATUS_LABELS[p.status]}</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          aria-label={`${p.title} 고르기`}
                          onClick={() => setPromotion({ id: p.id, title: p.title })}
                          disabled={promotion?.id === p.id}
                        >
                          {promotion?.id === p.id ? '고름' : '고르기'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {targetType === 'COUPONS' && <p className="form-hint">앱의 쿠폰함(/coupons)을 엽니다.</p>}
            {targetType === 'HOME' && <p className="form-hint">앱 홈(/)을 엽니다.</p>}
          </div>

          <div className="form-section">
            <h2 className="form-heading">보낼 시각</h2>
            <div className="sort-chips" role="group" aria-label="보내는 방법">
              <button type="button" className={mode === 'NOW' ? 'sort-chip active' : 'sort-chip'} aria-pressed={mode === 'NOW'} onClick={() => setMode('NOW')}>
                지금 보내기
              </button>
              <button
                type="button"
                className={mode === 'SCHEDULED' ? 'sort-chip active' : 'sort-chip'}
                aria-pressed={mode === 'SCHEDULED'}
                onClick={() => {
                  setMode('SCHEDULED')
                  setConfirmingNow(false)
                }}
              >
                예약
              </button>
            </div>
            {mode === 'SCHEDULED' && (
              <div className="push-schedule">
                <div className="form-field">
                  <label htmlFor="push-date">날짜</label>
                  <DateField id="push-date" value={date} onChange={setDate} min={today} />
                </div>
                <div className="form-field">
                  <label htmlFor="push-hour">시</label>
                  <Select
                    id="push-hour"
                    value={String(hour)}
                    onChange={(v) => setHour(Number(v))}
                    options={HOURS.map((h) => ({ value: String(h), label: `${pad(h)}시` }))}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="push-minute">분</label>
                  <Select
                    id="push-minute"
                    value={String(minute)}
                    onChange={(v) => setMinute(Number(v))}
                    options={MINUTES.map((m) => ({ value: String(m), label: `${pad(m)}분` }))}
                  />
                </div>
              </div>
            )}
            {mode === 'SCHEDULED' && (
              <p className="form-hint">
                한국 시간입니다. {MAX_SCHEDULE_DAYS}일 안쪽({addDays(today, MAX_SCHEDULE_DAYS).replaceAll('-', '.')}까지)으로 예약할 수 있습니다.
              </p>
            )}
            {mode === 'SCHEDULED' && schedulePast && <p className="error-text">{schedulePast}</p>}
            {audienceLine()}
          </div>

          <div className="form-actions">
            {confirmingNow ? (
              <span className="confirm-inline push-confirm" role="group" aria-label="지금 보내기 확인">
                <span>
                  {audience ? `알림 동의 ${audience.users.toLocaleString('ko-KR')}명에게 지금 보냅니다` : '알림 동의한 회원에게 지금 보냅니다'}
                  {audience?.night && ' (야간 수신 동의자만)'}
                </span>
                <button type="button" className="btn btn--primary" onClick={create} disabled={submitting}>
                  {submitting ? '보내는 중...' : '보내기 확인'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmingNow(false)} disabled={submitting}>
                  취소
                </button>
              </span>
            ) : (
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {mode === 'NOW' ? '보내기' : '예약하기'}
              </button>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
        </form>

        <aside className="push-side">
          <NotificationPreview title={title.trim()} body={body.trim()} imageUrl={imageUrl.trim()} />
          <div className="form-card push-test-card">
            <TestSendPanel build={buildForTest} />
          </div>
        </aside>
      </div>
    </div>
  )
}
