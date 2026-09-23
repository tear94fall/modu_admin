import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { hiddenClass, hiddenLabel, type Review, searchReviews, stars } from '../api/reviews'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatDateTime } from '../util/format'

const RATINGS = [5, 4, 3, 2, 1]

/** 리뷰 관리 목록. 내용·상품·작성자로 검색하고 별점·노출 상태로 거른다. */
export default function ReviewsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [hidden, setHidden] = useState<boolean | null>(null)
  const [page, setPage] = useState(0)
  const [reviews, setReviews] = useState<Review[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchReviews(searchTerm, page, { rating, hidden })
      .then((result) => {
        if (cancelled) return
        setReviews(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('리뷰 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, rating, hidden])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (id: number) => navigate(`/reviews/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }
  const filtered = searchTerm !== '' || rating !== null || hidden !== null

  return (
    <div>
      <h1>리뷰 관리</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="리뷰 검색" placeholder="내용/상품/작성자 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>
      <div className="filter-row">
        <select
          aria-label="별점"
          value={rating ?? ''}
          onChange={(e) => {
            setPage(0)
            setRating(e.target.value === '' ? null : Number(e.target.value))
          }}
        >
          <option value="">전체 별점</option>
          {RATINGS.map((r) => (
            <option key={r} value={r}>
              {r}점
            </option>
          ))}
        </select>
        <select
          aria-label="노출 상태"
          value={hidden === null ? '' : hidden ? 'hidden' : 'visible'}
          onChange={(e) => {
            setPage(0)
            setHidden(e.target.value === '' ? null : e.target.value === 'hidden')
          }}
        >
          <option value="">전체</option>
          <option value="visible">노출</option>
          <option value="hidden">숨김</option>
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && reviews.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '리뷰가 없습니다'}</p>}

      {!loading && !error && reviews.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {reviews.map((r, i) => (
              <li key={r.id}>
                <button type="button" className="card" onClick={() => open(r.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  {r.productImageUrl ? <img src={r.productImageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                  <span className="card-body">
                    <span className="card-title">{r.productName}</span>
                    <span className="card-line">
                      <span className="stars" aria-label={`별점 ${r.rating}점`}>
                        {stars(r.rating)}
                      </span>{' '}
                      · <span className={hiddenClass(r.hidden)}>{hiddenLabel(r.hidden)}</span>
                    </span>
                    <span className="card-line">{r.content}</span>
                    <span className="card-line card-muted">
                      {r.authorName} · {formatDateTime(r.createdAt ?? undefined)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && reviews.length > 0 && !isMobile && (
        <>
          <table className="list-table">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '27%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th>상품</th>
                <th>별점</th>
                <th>내용</th>
                <th>작성자</th>
                <th>작성일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r, i) => (
                <tr key={r.id} className="clickable-row" role="button" tabIndex={0} onClick={() => open(r.id)} onKeyDown={(e) => onRowKey(e, r.id)}>
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div className="review-product">
                      {r.productImageUrl ? <img src={r.productImageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                      <div className="review-product-body">
                        <div className="review-product-name" title={r.productName}>
                          {r.productName}
                        </div>
                        {r.optionLabel && <div className="card-muted">{r.optionLabel}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="stars" aria-label={`별점 ${r.rating}점`}>
                      {stars(r.rating)}
                    </span>{' '}
                    <span className="card-muted">{r.rating}</span>
                  </td>
                  <td>
                    <div className="review-content" title={r.content}>
                      {r.content}
                    </div>
                  </td>
                  <td>
                    <div>{r.authorName}</div>
                    {r.authorEmail && <div className="card-muted">{r.authorEmail}</div>}
                  </td>
                  <td>{formatDateTime(r.createdAt ?? undefined)}</td>
                  <td>
                    <span className={hiddenClass(r.hidden)}>{hiddenLabel(r.hidden)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
