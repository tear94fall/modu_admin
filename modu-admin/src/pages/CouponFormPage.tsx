import { type FormEvent, useEffect, useState } from 'react'
import DateField from '../components/DateField'
import { PERIOD_PRESETS, START_PRESETS } from '../util/dateInput'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type Category, flattenCategories, getCategories } from '../api/categories'
import { ApiError } from '../api/client'
import {
  type CouponDetail,
  type CouponInput,
  type CouponIssue,
  type CouponScope,
  createCoupon,
  deleteCoupon,
  type DiscountType,
  getCoupon,
  getCouponIssues,
  grantCoupon,
  type GrantResult,
  ISSUE_STATUS_LABELS,
  issueStatusClass,
  MAX_GRANT,
  quantityLabel,
  type ScopeTarget,
  SOURCE_LABELS,
  updateCoupon,
  type UserCouponStatus,
  validateCoupon,
} from '../api/coupons'
import { type Member, searchMembers } from '../api/members'
import { type ProductStatus, searchProducts, STATUS_LABELS, validationMessage } from '../api/products'
import { formatPromotionDate } from '../api/promotions'
import Pager from '../components/Pager'
import { formatPrice } from '../util/format'
import { formatUtcDateTime, timeZoneLabel, useDisplayTimeZone } from '../util/timeZone'

const MAX_SCOPE_PRODUCTS = 100

const ISSUE_FILTERS: { label: string; value: UserCouponStatus | null }[] = [
  { label: '전체', value: null },
  { label: '사용 가능', value: 'AVAILABLE' },
  { label: '사용함', value: 'USED' },
  { label: '만료', value: 'EXPIRED' },
]

type Validity = 'UNTIL' | 'DAYS'

/** 빈칸은 null, 그 밖에는 숫자(숫자가 아니면 NaN — 검사에서 걸린다). */
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

/** 발급 현황. 최신순 페이지, 상태로 거른다. */
function IssuesSection({ id, reloadKey }: { id: string; reloadKey: number }) {
  const timeZone = useDisplayTimeZone()
  const [status, setStatus] = useState<UserCouponStatus | null>(null)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<CouponIssue[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCouponIssues(id, page, status)
      .then((result) => {
        if (cancelled) return
        setRows(result.content)
        setTotal(result.totalElements)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('발급 현황을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, page, status, reloadKey])

  return (
    <section className="coupon-section" aria-label="발급 현황">
      <h2 className="form-heading">발급 현황{!loading && !error && ` (${total}장)`}</h2>
      <p className="time-zone-note">시각은 {timeZoneLabel(timeZone)} 기준, 만료일은 한국 날짜입니다.</p>
      <div className="sort-chips" role="group" aria-label="발급 상태">
        {ISSUE_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={status === f.value ? 'sort-chip active' : 'sort-chip'}
            aria-pressed={status === f.value}
            onClick={() => {
              setPage(0)
              setStatus(f.value)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && rows.length === 0 && <p>{status ? '해당 상태의 쿠폰이 없습니다' : '아직 발급된 쿠폰이 없습니다'}</p>}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="list-table coupon-issues-table">
              <thead>
                <tr>
                  <th>사용자 ID</th>
                  <th>경로</th>
                  <th>상태</th>
                  <th>발급 시각</th>
                  <th>만료일</th>
                  <th>사용 시각</th>
                  <th>주문번호</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td title={r.userId}>{r.userId}</td>
                    <td>{SOURCE_LABELS[r.source] ?? r.source}</td>
                    <td>
                      <span className={issueStatusClass(r.status)}>{ISSUE_STATUS_LABELS[r.status] ?? r.status}</span>
                    </td>
                    <td>{formatUtcDateTime(r.issuedAt, timeZone) || '-'}</td>
                    <td>{formatPromotionDate(r.expiresOn)}</td>
                    <td>{formatUtcDateTime(r.usedAt, timeZone) || '-'}</td>
                    <td title={r.orderNo ?? undefined}>{r.orderId != null ? <Link to={`/orders/${r.orderId}`}>{r.orderNo ?? r.orderId}</Link> : '-'}</td>
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

/** 회원에게 지급. 회원을 찾아 여러 명 고른 뒤 한 번에 지급한다. 받기 노출·발급 기간과 상관없이 주지만 수량·1인 1장은 지킨다. */
function GrantSection({ id, onGranted }: { id: string; onGranted: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Member[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Member[]>([])
  const [granting, setGranting] = useState(false)
  const [result, setResult] = useState<GrantResult | null>(null)
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
    if (picked.length >= MAX_GRANT || pickedIds.has(m.userId)) return
    setPicked([...picked, m])
  }

  const onGrant = async () => {
    if (picked.length === 0) return
    setGranting(true)
    setError(null)
    setResult(null)
    try {
      const r = await grantCoupon(
        id,
        picked.map((m) => m.userId),
      )
      setResult(r)
      setPicked([])
      onGranted()
    } catch (err) {
      setError(validationMessage(err) ?? '지급하지 못했습니다')
    } finally {
      setGranting(false)
    }
  }

  return (
    <section className="coupon-section" aria-label="회원에게 지급">
      <h2 className="form-heading">회원에게 지급</h2>
      <p className="form-hint">받기 노출·발급 기간과 상관없이 바로 줍니다. 총 수량과 1인 1장은 지킵니다. 한 번에 {MAX_GRANT}명까지.</p>
      <div className="inline-form">
        <input
          type="text"
          aria-label="회원 검색"
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
        <ul className="image-list promotion-search-results" aria-label="회원 검색 결과">
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
                disabled={pickedIds.has(m.userId) || picked.length >= MAX_GRANT}
              >
                {pickedIds.has(m.userId) ? '선택됨' : '선택'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked.length > 0 && (
        <ul className="grant-chips" aria-label="지급할 회원">
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
        <button type="button" className="btn btn--primary" onClick={onGrant} disabled={granting || picked.length === 0}>
          {picked.length > 0 ? `${picked.length}명에게 지급` : '지급'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {result && (
        <div className="result-text" role="status">
          <p>
            {result.issued}명 지급{result.skipped.length > 0 && `, ${result.skipped.length}명 제외`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="grant-skipped">
              {result.skipped.map((s) => (
                <li key={s.userId}>
                  {s.userId} — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/** /coupons/new 는 등록, /coupons/:id 는 수정·삭제 + 발급 현황 + 회원에게 지급. */
export default function CouponFormPage() {
  const { id } = useParams<{ id: string }>()
  const editing = id !== undefined
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('FIXED')
  const [discountValue, setDiscountValue] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('0')
  const [scope, setScope] = useState<CouponScope>('ALL')
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  /** 트리에 없는(지워진) 카테고리도 이름을 보여 주려고 불러온 대상 이름을 들고 있는다. */
  const [savedCategoryTargets, setSavedCategoryTargets] = useState<ScopeTarget[]>([])
  const [scopeProducts, setScopeProducts] = useState<ScopeTarget[]>([])
  const [issueStart, setIssueStart] = useState('')
  const [issueEnd, setIssueEnd] = useState('')
  const [validity, setValidity] = useState<Validity>('UNTIL')
  const [validUntil, setValidUntil] = useState('')
  const [validDays, setValidDays] = useState('')
  const [totalQuantity, setTotalQuantity] = useState('')
  const [code, setCode] = useState('')
  const [downloadable, setDownloadable] = useState(true)
  const [active, setActive] = useState(true)
  const [saved, setSaved] = useState<CouponDetail | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState(false)

  const [productKeyword, setProductKeyword] = useState('')
  const [productResults, setProductResults] = useState<{ id: number; name: string; price: number; status: ProductStatus }[] | null>(null)
  const [productSearching, setProductSearching] = useState(false)
  const [productSearchError, setProductSearchError] = useState<string | null>(null)

  const [loading, setLoading] = useState(editing)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issuesKey, setIssuesKey] = useState(0)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategoriesError(true))
  }, [])

  const fill = (c: CouponDetail) => {
    setName(c.name)
    setDescription(c.description ?? '')
    setDiscountType(c.discountType)
    setDiscountValue(String(c.discountValue))
    setMaxDiscount(c.maxDiscount != null ? String(c.maxDiscount) : '')
    setMinOrderAmount(String(c.minOrderAmount))
    setScope(c.scope)
    const targets = c.scopeTargets ?? []
    const nameOf = new Map(targets.map((t) => [t.id, t.name]))
    const scopeIds = c.scopeIds ?? []
    if (c.scope === 'CATEGORY') {
      setCategoryIds(scopeIds)
      setSavedCategoryTargets(scopeIds.map((sid) => ({ id: sid, name: nameOf.get(sid) ?? `#${sid}` })))
      setScopeProducts([])
    } else if (c.scope === 'PRODUCT') {
      setCategoryIds([])
      setScopeProducts(scopeIds.map((sid) => ({ id: sid, name: nameOf.get(sid) ?? `#${sid}` })))
    } else {
      setCategoryIds([])
      setScopeProducts([])
    }
    setIssueStart(c.issueStart)
    setIssueEnd(c.issueEnd)
    setValidity(c.validUntil ? 'UNTIL' : 'DAYS')
    setValidUntil(c.validUntil ?? '')
    setValidDays(c.validDays != null ? String(c.validDays) : '')
    setTotalQuantity(c.totalQuantity != null ? String(c.totalQuantity) : '')
    setCode(c.code ?? '')
    setDownloadable(c.downloadable)
    setActive(c.active)
    setSaved(c)
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getCoupon(id)
      .then((c) => {
        if (!cancelled) fill(c)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError('쿠폰을 불러오지 못했습니다')
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
      setProductResults(result.content.map((p) => ({ id: p.id, name: p.name, price: p.price, status: p.status })))
    } catch {
      setProductSearchError('상품을 찾지 못했습니다')
    } finally {
      setProductSearching(false)
    }
  }
  const addProduct = (p: ScopeTarget) => {
    if (scopeProducts.length >= MAX_SCOPE_PRODUCTS || scopeProducts.some((x) => x.id === p.id)) return
    setScopeProducts([...scopeProducts, { id: p.id, name: p.name }])
  }
  const toggleCategory = (cid: number, checked: boolean) =>
    setCategoryIds(checked ? (categoryIds.includes(cid) ? categoryIds : [...categoryIds, cid]) : categoryIds.filter((x) => x !== cid))

  /** 등록 후 발급·사용 수만 새로 읽는다(폼에 적던 값은 건드리지 않는다). */
  const refreshCounts = () => {
    setIssuesKey((k) => k + 1)
    if (!id) return
    getCoupon(id)
      .then((c) => setSaved((prev) => (prev ? { ...prev, issuedCount: c.issuedCount, usedCount: c.usedCount, totalQuantity: c.totalQuantity } : c)))
      .catch(() => {})
  }

  const input = (): CouponInput => {
    const trimmedCode = code.trim()
    return {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      discountType,
      discountValue: discountValue.trim() === '' ? Number.NaN : Number(discountValue),
      maxDiscount: discountType === 'PERCENT' ? numberOrNull(maxDiscount) : null,
      minOrderAmount: minOrderAmount.trim() === '' ? 0 : Number(minOrderAmount),
      scope,
      scopeIds: scope === 'CATEGORY' ? categoryIds : scope === 'PRODUCT' ? scopeProducts.map((p) => p.id) : [],
      issueStart,
      issueEnd,
      validUntil: validity === 'UNTIL' ? validUntil || null : null,
      validDays: validity === 'DAYS' ? (validDays.trim() === '' ? Number.NaN : Number(validDays)) : null,
      totalQuantity: numberOrNull(totalQuantity),
      code: trimmedCode === '' ? null : trimmedCode.toUpperCase(),
      downloadable,
      active,
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    const body = input()
    const invalid = validateCoupon(body)
    if (invalid) {
      setError(invalid)
      return
    }
    setSubmitting(true)
    try {
      if (id) {
        const result = await updateCoupon(id, body)
        fill(result)
        setMessage('저장했습니다')
      } else {
        await createCoupon(body)
        navigate('/coupons')
      }
    } catch (err) {
      setError(validationMessage(err) ?? (err instanceof ApiError && err.status === 409 ? '이미 쓰는 쿠폰 코드입니다' : '저장하지 못했습니다'))
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
      await deleteCoupon(id)
      navigate('/coupons', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(validationMessage(err) ?? '삭제하지 못했습니다')
      setSubmitting(false)
      setConfirmingDelete(false)
    }
  }

  const backLink = (
    <Link to="/coupons" className="back-link">
      ← 쿠폰 목록
    </Link>
  )

  if (loading) return <p>불러오는 중...</p>
  if (notFound)
    return (
      <div>
        {backLink}
        <p>쿠폰을 찾을 수 없습니다</p>
      </div>
    )
  if (loadError) return <p className="error-text">{loadError}</p>

  const flat = flattenCategories(categories)
  const inTree = new Set(flat.map((c) => c.id))
  const orphanCategories = savedCategoryTargets.filter((t) => !inTree.has(t.id) && categoryIds.includes(t.id))
  const addedProductIds = new Set(scopeProducts.map((p) => p.id))

  return (
    <div>
      {backLink}
      <h1>
        {editing ? '쿠폰 수정' : '새 쿠폰'}{' '}
        {saved && (
          <span className={saved.active ? 'status-badge status-badge--selling' : 'status-badge status-badge--cancelled'}>{saved.active ? '활성' : '비활성'}</span>
        )}
      </h1>
      {saved && <p className="coupon-stats">발급 {quantityLabel(saved)}</p>}
      <form className="form-card form-card--wide" onSubmit={onSubmit} noValidate>
        <div className="form-section">
          <h2 className="form-heading">기본 정보</h2>
          <div className="form-field">
            <label htmlFor="coupon-name">쿠폰 이름</label>
            <input id="coupon-name" className="input-lg" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="coupon-description">설명</label>
            <textarea id="coupon-description" rows={2} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">할인</h2>
          <fieldset className="form-field promotion-type">
            <legend>할인 방식</legend>
            <label className="form-check">
              <input type="radio" name="discount-type" value="FIXED" checked={discountType === 'FIXED'} onChange={() => setDiscountType('FIXED')} />
              정액
            </label>
            <label className="form-check">
              <input type="radio" name="discount-type" value="PERCENT" checked={discountType === 'PERCENT'} onChange={() => setDiscountType('PERCENT')} />
              정률
            </label>
            {editing && saved && saved.issuedCount > 0 && <p className="form-hint">이미 발급된 쿠폰도 있습니다. 할인·범위를 바꾸면 앞으로의 주문부터 적용됩니다.</p>}
          </fieldset>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="coupon-value">{discountType === 'FIXED' ? '할인 금액' : '할인율'}</label>
              <span className="input-unit">
                <input
                  id="coupon-value"
                  className={discountType === 'FIXED' ? 'input-sm' : 'input-xs'}
                  type="number"
                  min={1}
                  max={discountType === 'PERCENT' ? 90 : undefined}
                  step={1}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <span>{discountType === 'FIXED' ? '원' : '%'}</span>
              </span>
              {discountType === 'PERCENT' && <p className="form-hint">1~90%</p>}
            </div>
            {discountType === 'PERCENT' && (
              <div className="form-field">
                <label htmlFor="coupon-max">최대 할인</label>
                <span className="input-unit">
                  <input id="coupon-max" className="input-sm" type="number" min={1} step={1} placeholder="상한 없음" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />
                  <span>원</span>
                </span>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="coupon-min-order">최소 주문 금액</label>
              <span className="input-unit">
                <input id="coupon-min-order" className="input-sm" type="number" min={0} step={1} value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} />
                <span>원</span>
              </span>
              <p className="form-hint">주문 상품 합계와 비교합니다. 0 이면 조건 없음.</p>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">적용 범위</h2>
          <fieldset className="form-field promotion-type">
            <legend>범위</legend>
            <label className="form-check">
              <input type="radio" name="coupon-scope" value="ALL" checked={scope === 'ALL'} onChange={() => setScope('ALL')} />
              전체 상품
            </label>
            <label className="form-check">
              <input type="radio" name="coupon-scope" value="CATEGORY" checked={scope === 'CATEGORY'} onChange={() => setScope('CATEGORY')} />
              카테고리
            </label>
            <label className="form-check">
              <input type="radio" name="coupon-scope" value="PRODUCT" checked={scope === 'PRODUCT'} onChange={() => setScope('PRODUCT')} />
              지정 상품
            </label>
          </fieldset>

          {scope === 'CATEGORY' && (
            <div className="form-field">
              <span className="form-label">카테고리 ({categoryIds.length})</span>
              <p className="form-hint">상위 카테고리를 고르면 하위 카테고리 상품에도 적용됩니다.</p>
              {categoriesError && <p className="error-text">카테고리를 불러오지 못했습니다</p>}
              {!categoriesError && flat.length === 0 && orphanCategories.length === 0 && <p className="form-hint">등록된 카테고리가 없습니다</p>}
              <ul className="coupon-category-list" aria-label="카테고리 고르기">
                {flat.map((c) => (
                  <li key={c.id} className={c.parentId === null ? 'coupon-category' : 'coupon-category coupon-category--child'}>
                    <label className="form-check">
                      <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={(e) => toggleCategory(c.id, e.target.checked)} />
                      {c.label}
                    </label>
                  </li>
                ))}
                {orphanCategories.map((t) => (
                  <li key={t.id} className="coupon-category">
                    <label className="form-check">
                      <input type="checkbox" checked onChange={(e) => toggleCategory(t.id, e.target.checked)} />
                      {t.name} <span className="form-warning">(목록에 없는 카테고리)</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scope === 'PRODUCT' && (
            <div className="form-field">
              <span className="form-label">지정 상품 ({scopeProducts.length})</span>
              {scopeProducts.length > 0 && (
                <ul className="image-list" aria-label="지정 상품 목록">
                  {scopeProducts.map((p) => (
                    <li key={p.id} className="image-item">
                      <span className="image-url" title={p.name}>
                        {p.name}
                      </span>
                      <span className="image-actions">
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          aria-label={`${p.name} 빼기`}
                          onClick={() => setScopeProducts(scopeProducts.filter((x) => x.id !== p.id))}
                        >
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
                      <span className="image-url" title={p.name}>
                        {p.name} · {formatPrice(p.price)}
                        {p.status !== 'SELLING' && <span className="status-badge status-badge--cancelled"> {STATUS_LABELS[p.status] ?? p.status}</span>}
                      </span>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        aria-label={`${p.name} 추가`}
                        onClick={() => addProduct(p)}
                        disabled={addedProductIds.has(p.id) || scopeProducts.length >= MAX_SCOPE_PRODUCTS}
                      >
                        {addedProductIds.has(p.id) ? '추가됨' : '추가'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="form-section">
          <h2 className="form-heading">기간 · 수량</h2>
          <div className="date-range">
            <div className="form-field">
              <label htmlFor="coupon-issue-start">발급 시작일</label>
              <DateField id="coupon-issue-start" value={issueStart} onChange={setIssueStart} rangeStart={issueStart} rangeEnd={issueEnd} presets={START_PRESETS} />
            </div>
            <span className="date-range-sep" aria-hidden="true">
              ~
            </span>
            <div className="form-field">
              <label htmlFor="coupon-issue-end">발급 종료일</label>
              <DateField
                id="coupon-issue-end"
                value={issueEnd}
                onChange={setIssueEnd}
                min={issueStart || undefined}
                rangeStart={issueStart}
                rangeEnd={issueEnd}
                presets={PERIOD_PRESETS}
                presetBase={issueStart}
              />
            </div>
          </div>
          <p className="form-hint">받기·코드·이벤트로 받을 수 있는 기간입니다. 한국 날짜 기준, 시작일·종료일 포함.</p>
          <fieldset className="form-field promotion-type">
            <legend>사용 기한</legend>
            <label className="form-check">
              <input type="radio" name="coupon-validity" value="UNTIL" checked={validity === 'UNTIL'} onChange={() => setValidity('UNTIL')} />
              날짜까지
            </label>
            <label className="form-check">
              <input type="radio" name="coupon-validity" value="DAYS" checked={validity === 'DAYS'} onChange={() => setValidity('DAYS')} />
              받은 날부터 N일
            </label>
          </fieldset>
          {validity === 'UNTIL' ? (
            <div className="form-field">
              <label htmlFor="coupon-valid-until">사용 기한 날짜</label>
              <DateField id="coupon-valid-until" value={validUntil} onChange={setValidUntil} min={issueStart || undefined} presets={PERIOD_PRESETS} presetBase={issueStart || undefined} />
              <p className="form-hint">이 날(한국 날짜)까지 쓸 수 있습니다.</p>
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="coupon-valid-days">사용 기한 일수</label>
              <span className="input-unit">
                <input id="coupon-valid-days" className="input-xs" type="number" min={1} step={1} value={validDays} onChange={(e) => setValidDays(e.target.value)} />
                <span>일</span>
              </span>
              <p className="form-hint">받은 날을 1일째로 셉니다. 7이면 받은 날부터 7일째까지.</p>
            </div>
          )}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="coupon-quantity">총 수량</label>
              <span className="input-unit">
                <input id="coupon-quantity" className="input-sm" type="number" min={1} step={1} placeholder="무제한" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} />
                <span>장</span>
              </span>
              <p className="form-hint">비우면 무제한</p>
            </div>
            <div className="form-field">
              <label htmlFor="coupon-code">쿠폰 코드</label>
              <input
                id="coupon-code"
                className="input-md input-code"
                value={code}
                maxLength={20}
                placeholder="예: WELCOME2026"
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              />
              <p className="form-hint">입력하면 앱에서 코드로 받을 수 있어요. 영문 대문자·숫자 4~20자.</p>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">노출</h2>
          <label className="form-check" htmlFor="coupon-downloadable">
            <input id="coupon-downloadable" type="checkbox" checked={downloadable} onChange={(e) => setDownloadable(e.target.checked)} />
            앱에서 받기 노출
          </label>
          <p className="form-hint">켜면 앱의 쿠폰 받기 목록·상품 화면에 보입니다. 꺼도 코드·이벤트·관리자 지급으로는 받을 수 있습니다.</p>
          <label className="form-check" htmlFor="coupon-active">
            <input id="coupon-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            활성
          </label>
          <p className="form-hint">끄면 새로 받을 수 없습니다.</p>
        </div>

        <div className="form-actions">
          {editing && !confirmingDelete && (
            <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)} disabled={submitting}>
              삭제
            </button>
          )}
          {editing && confirmingDelete && (
            <span className="confirm-inline" role="group" aria-label="삭제 확인">
              <span>'{saved?.name}' 쿠폰을 삭제할까요? 이미 받은 쿠폰은 기한까지 쓸 수 있습니다.</span>
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

      {editing && id && (
        <>
          <GrantSection id={id} onGranted={refreshCounts} />
          <IssuesSection id={id} reloadKey={issuesKey} />
        </>
      )}
    </div>
  )
}
