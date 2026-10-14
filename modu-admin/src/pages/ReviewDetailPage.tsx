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
      <div className="detail-layout">
        <aside className="member-profile summary-card" aria-label="리뷰 정보">
          <div className="member-profile-cover member-profile-cover--empty" />
          <div className="member-profile-head">
            <span className="summary-icon summary-icon--amber">
              {review.productImageUrl ? (
                <img src={review.productImageUrl} alt="" />
              ) : (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                  <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
                </svg>
              )}
            </span>
            <div className="member-profile-name">
              <h1 className="profile-username">리뷰 #{review.id}</h1>
              <span className={hiddenClass(review.hidden)}>{hiddenLabel(review.hidden)}</span>
            </div>
            <p className="member-profile-email">{review.productName}</p>
          </div>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">별점</h2>
            <div className="summary-figure">
              <span className="summary-figure-value">
                <span className="stars review-stars-lg" aria-label={`별점 ${review.rating}점`}>
                  {stars(review.rating)}
                </span>
              </span>
              <span className="summary-figure-note">{review.rating}점 / 5점</span>
            </div>
          </div>

          <dl className="member-profile-facts">
            <dt>작성자</dt>
            <dd>{review.authorName}</dd>
            {review.authorEmail && (
              <>
                <dt>이메일</dt>
                <dd>{review.authorEmail}</dd>
              </>
            )}
            <dt>작성일</dt>
            <dd>{formatDateTime(review.createdAt ?? undefined)}</dd>
            {review.updatedAt && review.updatedAt !== review.createdAt && (
              <>
                <dt>수정일</dt>
                <dd>{formatDateTime(review.updatedAt)}</dd>
              </>
            )}
          </dl>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">관리</h2>
            <div className="summary-actions">
              {review.hidden ? (
                <button type="button" className="btn btn--primary" disabled={working} onClick={() => setHidden(false)}>
                  노출하기
                </button>
              ) : (
                <button type="button" className="btn btn--secondary" disabled={working || hiding} onClick={() => setHiding(true)}>
                  숨기기
                </button>
              )}
              <button type="button" className="btn btn--danger" disabled={working} onClick={remove}>
                삭제
              </button>
            </div>
            {message && <p className="result-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
        </aside>

        <div className="detail-main">
          <section className="section-card" aria-label="리뷰 내용">
            <div className="section-card-head">
              <h2 className="section-card-title">내용</h2>
            </div>
            <blockquote className="review-quote">
              <p className="review-body">{review.content}</p>
            </blockquote>
            {review.hidden && review.hiddenReason && <p className="review-hidden-reason review-hidden-note">숨김 사유: {review.hiddenReason}</p>}
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
          </section>

          <section className="section-card" aria-label="리뷰한 상품">
            <div className="section-card-head">
              <h2 className="section-card-title">상품</h2>
            </div>
            <div className="review-product review-product-card">
              {review.productImageUrl ? <img src={review.productImageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
              <div className="review-product-body">
                <Link to={`/products/${review.productId}`} className="review-product-name">
                  {review.productName}
                </Link>
                {review.optionLabel && <div className="card-muted">{review.optionLabel}</div>}
                <span className="card-muted">상품 #{review.productId}</span>
              </div>
            </div>
          </section>

          <section className="section-card" aria-label="노출 안내">
            <div className="section-card-head">
              <h2 className="section-card-title">노출 상태</h2>
            </div>
            <p className="summary-text">
              {review.hidden
                ? '숨긴 리뷰입니다. 앱의 리뷰 목록과 상품 평점에서 빠지고, 작성자에게는 숨김 사유가 보입니다.'
                : '앱의 상품 리뷰 목록에 보이고 상품 평점에 들어갑니다. 숨기면 목록과 평점에서 빠집니다.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
