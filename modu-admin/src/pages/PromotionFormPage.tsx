import { type FormEvent, useEffect, useState } from 'react'
import DateField from '../components/DateField'
import { PERIOD_PRESETS, START_PRESETS } from '../util/dateInput'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { CouponSummary } from '../api/coupons'
import { formatPoints, listRules, type PointRule } from '../api/points'
import { searchProducts, STATUS_LABELS, validationMessage } from '../api/products'
import {
  type Attendance,
  createPromotion,
  DEFAULT_BANNER_COLOR,
  deletePromotion,
  type EventKind,
  formatPromotionDate,
  getAttendances,
  getPromotion,
  HEX_COLOR,
  MAX_PROMOTION_COUPONS,
  PROMOTION_STATUS_LABELS,
  type PromotionDetail,
  type PromotionInput,
  type PromotionProduct,
  type PromotionStatus,
  type PromotionType,
  promotionStatusClass,
  ruleOptionLabel,
  updatePromotion,
  validatePromotion,
} from '../api/promotions'
import CouponPicker from '../components/CouponPicker'
import Pager from '../components/Pager'
import { formatPrice } from '../util/format'
import { formatUtcDateTime, timeZoneLabel, useDisplayTimeZone } from '../util/timeZone'

/** 배너 색 빠른 선택. */
const BANNER_PALETTE = ['#E11D48', '#F97316', '#F59E0B', '#16A34A', '#0EA5E9', '#2563EB', '#7C3AED', '#DB2777', '#111827']

/** 시작·종료일 포함 일수. */
function daysBetween(start: string, end: string): number {
  const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8)))
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1
}

const MAX_PRODUCTS = 100

/** 배너 미리보기. 앱처럼 대략 2:1 로, 이미지(없으면 배너 색) 위에 제목·부제를 얹는다. */
function BannerPreview({ imageUrl, color, title, subtitle }: { imageUrl: string; color: string; title: string; subtitle: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const background = HEX_COLOR.test(color) ? color : DEFAULT_BANNER_COLOR
  return (
    <div className="promotion-banner" data-testid="banner-preview" style={{ background }}>
      {imageUrl && failed !== imageUrl && <img src={imageUrl} alt="배너 미리보기" onError={() => setFailed(imageUrl)} />}
      <div className="promotion-banner-text">
        <strong>{title || '제목'}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  )
}

/** 이벤트 출석 현황. 최신순 페이지. */
function AttendanceSection({ id }: { id: string }) {
  const timeZone = useDisplayTimeZone()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Attendance[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAttendances(id, page)
      .then((result) => {
        if (cancelled) return
        setRows(result.content)
        setTotal(result.totalElements)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('출석 현황을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, page])

  return (
    <section className="promotion-attendance" aria-label="출석 현황">
      <h2 className="form-heading">출석 현황{!loading && !error && ` (${total}회)`}</h2>
      <p className="time-zone-note">시각은 {timeZoneLabel(timeZone)} 기준, 출석일은 한국 날짜입니다.</p>
      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && rows.length === 0 && <p>아직 출석한 사람이 없습니다</p>}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="list-table">
              <thead>
                <tr>
                  <th>사용자 ID</th>
                  <th>출석일</th>
                  <th>적립 포인트</th>
                  <th>사유</th>
                  <th>시각</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={`${a.userId}-${a.checkDate}`}>
                    <td title={a.userId}>{a.userId}</td>
                    <td>{formatPromotionDate(a.checkDate)}</td>
                    <td>{formatPoints(a.rewardPoints)}</td>
                    <td>{a.rewardMessage ?? '-'}</td>
                    <td>{formatUtcDateTime(a.createdAt, timeZone) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </section>
  )
}

/**
 * /promotions/new 는 등록, /promotions/:id 는 수정·삭제. 기획전은 상품 목록(+ 기획전 쿠폰),
 * 이벤트는 종류에 따라 출석 체크 보상 규칙 또는 쿠폰 받기 쿠폰을 고른다.
 */
export default function PromotionFormPage() {
  const { id } = useParams<{ id: string }>()
  const editing = id !== undefined
  const navigate = useNavigate()

  const [type, setType] = useState<PromotionType>('EXHIBITION')
  const [eventKind, setEventKind] = useState<EventKind>('ATTENDANCE')
  const [coupons, setCoupons] = useState<CouponSummary[]>([])
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [bannerImageUrl, setBannerImageUrl] = useState('')
  const [bannerColor, setBannerColor] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [visible, setVisible] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')
  const [products, setProducts] = useState<PromotionProduct[]>([])
  const [pointRuleCode, setPointRuleCode] = useState('')
  /** 불러온 이벤트의 보상 점수. 규칙이 목록에서 사라졌을 때 그대로 다시 보낸다. */
  const [savedRewardPoints, setSavedRewardPoints] = useState<number | null>(null)
  const [status, setStatus] = useState<PromotionStatus | null>(null)
  const [savedTitle, setSavedTitle] = useState('')

  const [rules, setRules] = useState<PointRule[]>([])
  const [rulesError, setRulesError] = useState(false)

  const [productKeyword, setProductKeyword] = useState('')
  const [productResults, setProductResults] = useState<PromotionProduct[] | null>(null)
  const [productSearching, setProductSearching] = useState(false)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)

  const [loading, setLoading] = useState(editing)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRules()
      .then(setRules)
      .catch(() => setRulesError(true))
  }, [])

  const fill = (p: PromotionDetail) => {
    setType(p.type)
    setEventKind(p.eventKind ?? 'ATTENDANCE')
    setCoupons(p.coupons ?? [])
    setTitle(p.title)
    setSubtitle(p.subtitle ?? '')
    setDescription(p.description ?? '')
    setBannerImageUrl(p.bannerImageUrl ?? '')
    setBannerColor(p.bannerColor ?? '')
    setStartDate(p.startDate)
    setEndDate(p.endDate)
    setVisible(p.visible)
    setSortOrder(String(p.sortOrder))
    setProducts(p.products ?? [])
    setPointRuleCode(p.pointRuleCode ?? '')
    setSavedRewardPoints(p.rewardPoints)
    setStatus(p.status)
    setSavedTitle(p.title)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getPromotion(id)
      .then((p) => {
        if (!cancelled) fill(p)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError('기획전·이벤트를 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const onProductSearch = async () => {
    setProductSearching(true)
    setProductSearchError(null)
    try {
      const result = await searchProducts(productKeyword.trim(), 0)
      setProductResults(
        result.content.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, listPrice: p.listPrice, status: p.status })),
      )
    } catch {
      setProductSearchError('상품을 찾지 못했습니다')
    } finally {
      setProductSearching(false)
    }
  }
  const addProduct = (p: PromotionProduct) => {
    if (products.length >= MAX_PRODUCTS || products.some((x) => x.id === p.id)) return
    setProducts([...products, p])
  }
  const moveProduct = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= products.length) return
    const next = [...products]
    ;[next[index], next[target]] = [next[target], next[index]]
    setProducts(next)
  }

  const selectedRule = rules.find((r) => r.code === pointRuleCode) ?? null
  const trimmedColor = bannerColor.trim()

  const input = (): PromotionInput => {
    const base: PromotionInput = {
      type,
      title: title.trim(),
      subtitle: subtitle.trim() === '' ? null : subtitle.trim(),
      description: description.trim() === '' ? null : description.trim(),
      bannerImageUrl: bannerImageUrl.trim() === '' ? null : bannerImageUrl.trim(),
      bannerColor: trimmedColor === '' ? null : trimmedColor.toUpperCase(),
      startDate,
      endDate,
      visible,
      sortOrder: sortOrder.trim() === '' ? 0 : Number(sortOrder),
    }
    const couponIds = coupons.map((c) => c.id)
    if (type === 'EXHIBITION') return { ...base, productIds: products.map((p) => p.id), couponIds }
    if (eventKind === 'COUPON') return { ...base, eventKind, couponIds }
    const code = pointRuleCode === '' ? null : pointRuleCode
    return { ...base, eventKind, pointRuleCode: code, rewardPoints: code === null ? null : (selectedRule?.points ?? savedRewardPoints) }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const body = input()
    const invalid = validatePromotion(body)
    if (invalid) {
      setError(invalid)
      return
    }
    setSubmitting(true)
    try {
      if (id) {
        const saved = await updatePromotion(id, body)
        fill(saved)
        setMessage('저장했습니다')
      } else {
        await createPromotion(body)
        navigate('/promotions')
      }
    } catch (err) {
      setError(validationMessage(err) ?? '저장하지 못했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (!id) return
    setMessage(null)
    setError(null)
    setSubmitting(true)
    try {
      await deletePromotion(id)
      navigate('/promotions', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(validationMessage(err) ?? '삭제하지 못했습니다')
      setSubmitting(false)
      setConfirmingDelete(false)
    }
  }

  const backLink = (
    <Link to="/promotions" className="back-link">
      ← 기획전·이벤트 목록
    </Link>
  )

  if (loading) return <p>불러오는 중...</p>
  if (notFound)
    return (
      <div>
        {backLink}
        <p>기획전·이벤트를 찾을 수 없습니다</p>
      </div>
    )
  if (loadError) return <p className="error-text">{loadError}</p>

  const addedIds = new Set(products.map((p) => p.id))
  /** 목록에 없는 규칙(지워진 규칙)을 가리키는 이벤트도 선택값을 잃지 않게 한다. */
  const missingRule = pointRuleCode !== '' && !selectedRule && !rulesError && rules.length > 0

  return (
    <div>
      {backLink}
      <h1>
        {editing ? '기획전·이벤트 수정' : '기획전·이벤트 만들기'}{' '}
        {status && <span className={promotionStatusClass(status)}>{PROMOTION_STATUS_LABELS[status]}</span>}
      </h1>
      <form className="form-card form-card--wide" onSubmit={onSubmit} noValidate>
        <div className="form-section">
          <h2 className="form-heading">기본 정보</h2>
          <fieldset className="form-field promotion-type">
            <legend>종류</legend>
            <label className="form-check">
              <input type="radio" name="promotion-type" value="EXHIBITION" checked={type === 'EXHIBITION'} disabled={editing} onChange={() => setType('EXHIBITION')} />
              기획전
            </label>
            <label className="form-check">
              <input type="radio" name="promotion-type" value="EVENT" checked={type === 'EVENT'} disabled={editing} onChange={() => setType('EVENT')} />
              이벤트
            </label>
            {editing && <p className="form-hint">종류는 만든 뒤 바꿀 수 없습니다.</p>}
          </fieldset>
          <div className="form-field">
            <label htmlFor="promotion-title">제목</label>
            <input id="promotion-title" className="input-lg" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="promotion-subtitle">부제</label>
            <input id="promotion-subtitle" className="input-lg" value={subtitle} maxLength={100} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="promotion-description">설명</label>
            <textarea id="promotion-description" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="date-range">
            <div className="form-field">
              <label htmlFor="promotion-start">시작일</label>
              <DateField id="promotion-start" value={startDate} onChange={setStartDate} rangeStart={startDate} rangeEnd={endDate} presets={START_PRESETS} />
            </div>
            <span className="date-range-sep" aria-hidden="true">
              ~
            </span>
            <div className="form-field">
              <label htmlFor="promotion-end">종료일</label>
              <DateField
                id="promotion-end"
                value={endDate}
                onChange={setEndDate}
                min={startDate || undefined}
                rangeStart={startDate}
                rangeEnd={endDate}
                presets={PERIOD_PRESETS}
                presetBase={startDate}
              />
            </div>
            {startDate && endDate && endDate >= startDate && <span className="date-range-days">{daysBetween(startDate, endDate)}일간</span>}
          </div>
          <p className="form-hint">기간은 한국 날짜 기준이며 시작일·종료일을 포함합니다.</p>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="promotion-sort">순서</label>
              <input id="promotion-sort" className="input-xs" type="number" step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              <p className="form-hint">작을수록 앞에 나옵니다.</p>
            </div>
            <label className="form-check form-check--toggle" htmlFor="promotion-visible">
              <input id="promotion-visible" type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              앱에 노출
            </label>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">배너</h2>
          <div className="form-field">
            <label htmlFor="promotion-image">배너 이미지 URL</label>
            <input id="promotion-image" className="input-lg" type="url" placeholder="https://" value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="promotion-color">배너 색</label>
            <div className="inline-form">
              <input
                type="color"
                aria-label="배너 색 고르기"
                className="color-input"
                value={HEX_COLOR.test(trimmedColor) ? trimmedColor.toLowerCase() : DEFAULT_BANNER_COLOR.toLowerCase()}
                onChange={(e) => setBannerColor(e.target.value.toUpperCase())}
              />
              <input id="promotion-color" className="input-sm" placeholder={DEFAULT_BANNER_COLOR} maxLength={7} value={bannerColor} onChange={(e) => setBannerColor(e.target.value)} />
              <span className="palette" role="group" aria-label="자주 쓰는 색">
                {BANNER_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={trimmedColor.toUpperCase() === c ? 'palette-swatch palette-swatch--on' : 'palette-swatch'}
                    style={{ background: c }}
                    aria-label={`배너 색 ${c}`}
                    onClick={() => setBannerColor(c)}
                  />
                ))}
              </span>
            </div>
            <p className="form-hint">비우면 기본 색({DEFAULT_BANNER_COLOR})을 씁니다.</p>
          </div>
          <BannerPreview imageUrl={bannerImageUrl.trim()} color={trimmedColor} title={title.trim()} subtitle={subtitle.trim()} />
        </div>

        {type === 'EXHIBITION' ? (
          <div className="form-section">
            <h2 className="form-heading">상품 ({products.length})</h2>
            <p className="form-hint">위에서부터 앱에 보이는 순서입니다. 1~{MAX_PRODUCTS}개. 숨김 상품은 앱에서 빠집니다.</p>
            {products.length > 0 && (
              <ul className="image-list">
                {products.map((p, i) => (
                  <li key={p.id} className="image-item">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                    <span className="image-url" title={p.name}>
                      {p.name} · {formatPrice(p.price)}{' '}
                      <span className={p.status === 'SELLING' ? 'status-badge status-badge--selling' : 'status-badge status-badge--cancelled'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </span>
                    <span className="image-actions">
                      <button type="button" className="btn btn--secondary btn--sm" aria-label={`${p.name} 위로`} onClick={() => moveProduct(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        aria-label={`${p.name} 아래로`}
                        onClick={() => moveProduct(i, 1)}
                        disabled={i === products.length - 1}
                      >
                        ↓
                      </button>
                      <button type="button" className="btn btn--danger btn--sm" aria-label={`${p.name} 빼기`} onClick={() => setProducts(products.filter((x) => x.id !== p.id))}>
                        빼기
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
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
                      aria-label={`${p.name} 추가`}
                      onClick={() => addProduct(p)}
                      disabled={addedIds.has(p.id) || products.length >= MAX_PRODUCTS}
                    >
                      {addedIds.has(p.id) ? '추가됨' : '추가'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="form-subheading">기획전 쿠폰 ({coupons.length})</h3>
            <p className="form-hint">선택 사항입니다. 0~{MAX_PROMOTION_COUPONS}개. 앱 기획전 화면에서 받기 버튼으로 보여 줍니다.</p>
            <CouponPicker label="기획전 쿠폰" selected={coupons} onChange={setCoupons} max={MAX_PROMOTION_COUPONS} />
          </div>
        ) : (
          <div className="form-section">
            <h2 className="form-heading">이벤트</h2>
            <fieldset className="form-field promotion-type">
              <legend>이벤트 종류</legend>
              <label className="form-check">
                <input type="radio" name="event-kind" value="ATTENDANCE" checked={eventKind === 'ATTENDANCE'} disabled={editing} onChange={() => setEventKind('ATTENDANCE')} />
                출석 체크
              </label>
              <label className="form-check">
                <input type="radio" name="event-kind" value="COUPON" checked={eventKind === 'COUPON'} disabled={editing} onChange={() => setEventKind('COUPON')} />
                쿠폰 받기
              </label>
              <p className="form-hint">
                {eventKind === 'ATTENDANCE'
                  ? '출석 체크 — 기간 동안 하루 한 번 출석하면 보상 포인트를 줍니다.'
                  : '쿠폰 받기 — 기간 동안 버튼 한 번으로 이벤트 쿠폰을 모두 받습니다.'}
                {editing && ' 이벤트 종류는 만든 뒤 바꿀 수 없습니다.'}
              </p>
            </fieldset>
            {eventKind === 'COUPON' ? (
              <div className="form-field">
                <span className="form-label">이벤트 쿠폰 ({coupons.length})</span>
                <p className="form-hint">
                  1~{MAX_PROMOTION_COUPONS}개. 받기 노출과 상관없이 주지만, 쿠폰의 발급 기간·수량·활성은 지킵니다.
                </p>
                <CouponPicker label="이벤트 쿠폰" selected={coupons} onChange={setCoupons} max={MAX_PROMOTION_COUPONS} />
              </div>
            ) : (
              <div className="form-field">
                <label htmlFor="promotion-rule">보상 포인트 규칙</label>
                <select id="promotion-rule" value={pointRuleCode} onChange={(e) => setPointRuleCode(e.target.value)}>
                  <option value="">보상 없음</option>
                  {rules.map((r) => (
                    <option key={r.code} value={r.code}>
                      {ruleOptionLabel(r)}
                    </option>
                  ))}
                  {pointRuleCode !== '' && !selectedRule && (
                    <option value={pointRuleCode}>
                      {pointRuleCode}
                      {savedRewardPoints != null ? ` · ${formatPoints(savedRewardPoints)}` : ''}
                    </option>
                  )}
                </select>
                {rulesError && <p className="error-text">포인트 규칙을 불러오지 못했습니다</p>}
                {missingRule && <p className="form-warning">이 규칙은 포인트 규칙 목록에 없습니다. 적립이 되지 않을 수 있습니다.</p>}
                {selectedRule && !selectedRule.enabled && (
                  <p className="form-warning">꺼진 규칙입니다. 켜기 전까지는 출석해도 포인트가 적립되지 않습니다.</p>
                )}
                {selectedRule && selectedRule.dailyLimit == null && (
                  <p className="form-warning">하루 한도가 없는 규칙입니다. 같은 규칙을 쓰는 다른 곳에서 하루에 여러 번 적립될 수 있습니다.</p>
                )}
                <p className="form-hint">규칙의 점수가 출석 1회 보상으로 저장됩니다. 점수·한도는 포인트 &gt; 적립 규칙에서 바꿉니다.</p>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          {editing && !confirmingDelete && (
            <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)} disabled={submitting}>
              삭제
            </button>
          )}
          {editing && confirmingDelete && (
            <span className="confirm-inline" role="group" aria-label="삭제 확인">
              <span>'{savedTitle}' 을(를) 삭제할까요?</span>
              <button type="button" className="btn btn--danger" onClick={onDelete} disabled={submitting}>
                삭제 확인
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmingDelete(false)} disabled={submitting}>
                취소
              </button>
            </span>
          )}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {editing ? '저장' : '등록'}
          </button>
        </div>
      </form>

      {message && <p className="result-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      {editing && id && type === 'EVENT' && eventKind === 'ATTENDANCE' && <AttendanceSection id={id} />}
    </div>
  )
}
