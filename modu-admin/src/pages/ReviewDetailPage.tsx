import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { validationMessage } from '../api/products'
import { deleteReview, getReview, hiddenClass, hiddenLabel, type Review, setReviewHidden, stars } from '../api/reviews'
import { formatDateTime } from '../util/format'

/** 리뷰 상세. 숨기기(사유 선택)·노출하기·삭제. 숨김 리뷰는 앱 목록과 평점에서 빠지고 작성자에게 사유가 보인다. */
export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hiding, setHiding] = useState(false)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getReview(id)
      .then((r) => {
        if (!cancelled) setReview(r)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError('리뷰를 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const setHidden = async (hidden: boolean, hideReason?: string) => {
    if (!id) return
    setMessage(null)
    setError(null)
    setWorking(true)
    try {
      const saved = await setReviewHidden(id, hidden, hideReason)
      setReview(saved)
      setHiding(false)
      setReason('')
      setMessage(hidden ? '리뷰를 숨겼습니다' : '리뷰를 다시 노출했습니다')
    } catch (err) {
      setError(validationMessage(err) ?? (hidden ? '리뷰를 숨기지 못했습니다' : '리뷰를 노출하지 못했습니다'))
    } finally {
      setWorking(false)
    }
  }

  const onHide = (e: FormEvent) => {
    e.preventDefault()
    void setHidden(true, reason.trim() || undefined)
  }

  const remove = async () => {
    if (!id || !window.confirm('리뷰를 삭제할까요? 되돌릴 수 없습니다.')) return
    setError(null)
    setWorking(true)
    try {
      await deleteReview(id)
      navigate('/reviews', { replace: true })
    } catch (err) {
      setError(validationMessage(err) ?? '리뷰를 삭제하지 못했습니다')
      setWorking(false)
    }
  }

  const backLink = (
    <Link to="/reviews" className="back-link">
      ← 리뷰 목록
    </Link>
  )
  if (loading) return <p>불러오는 중...</p>
  if (notFound)
    return (
      <div>
        {backLink}
        <p>리뷰를 찾을 수 없습니다</p>
      </div>
    )
  if (loadError || !review) return <p className="error-text">{loadError}</p>

  return (
    <div>
      {backLink}
      <h1>리뷰 #{review.id}</h1>
      <div className="form-card form-card--wide">
        <div className="form-section">
          <div className="order-status-row">
            <span className={hiddenClass(review.hidden)}>{hiddenLabel(review.hidden)}</span>
            <span className="order-actions">
              {review.hidden ? (
                <button type="button" className="btn btn--primary btn--sm" disabled={working} onClick={() => setHidden(false)}>
                  노출하기
                </button>
              ) : (
                <button type="button" className="btn btn--secondary btn--sm" disabled={working || hiding} onClick={() => setHiding(true)}>
                  숨기기
                </button>
              )}
              <button type="button" className="btn btn--danger btn--sm" disabled={working} onClick={remove}>
                삭제
              </button>
            </span>
          </div>
          {review.hidden && review.hiddenReason && <p className="review-hidden-reason">숨김 사유: {review.hiddenReason}</p>}
          {hiding && (
            <form className="review-hide-form" onSubmit={onHide}>
              <label>
                숨김 사유 (선택, 작성자에게 보입니다)
                <input type="text" aria-label="숨김 사유" maxLength={200} value={reason} placeholder="예: 욕설·비방 포함" onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary btn--sm" disabled={working}>
                  확인
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={working}
                  onClick={() => {
                    setHiding(false)
                    setReason('')
                  }}
                >
                  취소
                </button>
              </div>
            </form>
          )}
          <div className="review-product">
            {review.productImageUrl ? <img src={review.productImageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
            <div className="review-product-body">
              <Link to={`/products/${review.productId}`} className="review-product-name">
                {review.productName}
              </Link>
              {review.optionLabel && <div className="card-muted">{review.optionLabel}</div>}
            </div>
          </div>
          <dl className="detail-grid">
            <dt>별점</dt>
            <dd>
              <span className="stars" aria-label={`별점 ${review.rating}점`}>
                {stars(review.rating)}
              </span>{' '}
              {review.rating}점
            </dd>
            <dt>작성자</dt>
            <dd>
              {review.authorName}
              {review.authorEmail && <span className="card-muted"> · {review.authorEmail}</span>}
            </dd>
            <dt>작성일</dt>
            <dd>{formatDateTime(review.createdAt ?? undefined)}</dd>
            {review.updatedAt && review.updatedAt !== review.createdAt && (
              <>
                <dt>수정일</dt>
                <dd>{formatDateTime(review.updatedAt)}</dd>
              </>
            )}
          </dl>
        </div>
        <div className="form-section">
          <h2 className="form-heading">내용</h2>
          <p className="review-body">{review.content}</p>
        </div>
      </div>
      {message && <p className="result-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
