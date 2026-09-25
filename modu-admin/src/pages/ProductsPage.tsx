import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { type Category, flattenCategories, getCategories } from '../api/categories'
import { PAGE_SIZE } from '../api/client'
import { type ProductStatus, type ProductSummary, STATUS_LABELS, searchProducts } from '../api/products'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatPrice } from '../util/format'

export default function ProductsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<ProductStatus | null>(null)
  const [page, setPage] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])
  /** 서버가 돌려준 페이지 번호(0-based). 순번은 지금 표에 깔린 데이터 기준으로 매긴다. */
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 필터용 트리. 못 받아도 목록은 그대로 보인다.
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchProducts(searchTerm, page, { categoryId, status })
      .then((result) => {
        if (cancelled) return
        setProducts(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('상품 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, categoryId, status])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }

  const open = (id: number) => navigate(`/products/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }

  const filtered = searchTerm !== '' || categoryId !== null || status !== null
  const stockText = (p: ProductSummary) => (p.totalStock === 0 ? '품절' : `${p.totalStock}`)

  return (
    <div>
      <h1>상품 관리</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input
            type="text"
            aria-label="상품 검색"
            placeholder="상품 이름/설명 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
        <Link to="/products/new" className="btn btn--primary">
          상품 등록
        </Link>
      </div>
      <div className="filter-row">
        <select
          aria-label="카테고리"
          value={categoryId ?? ''}
          onChange={(e) => {
            setPage(0)
            setCategoryId(e.target.value === '' ? null : Number(e.target.value))
          }}
        >
          <option value="">전체 카테고리</option>
          {flattenCategories(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="판매 상태"
          value={status ?? ''}
          onChange={(e) => {
            setPage(0)
            setStatus(e.target.value === '' ? null : (e.target.value as ProductStatus))
          }}
        >
          <option value="">전체 상태</option>
          <option value="SELLING">판매중</option>
          <option value="HIDDEN">숨김</option>
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && products.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '등록된 상품이 없습니다'}</p>}

      {!loading && !error && products.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {products.map((p, i) => (
              <li key={p.id}>
                <button type="button" className="card" onClick={() => open(p.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="product-thumb" />
                  ) : (
                    <span className="product-thumb image-placeholder" />
                  )}
                  <span className="card-body">
                    <span className="card-title">{p.name}</span>
                    <span className="card-line">{formatPrice(p.price)}</span>
                    <span className="card-line card-muted">
                      {p.categoryName ?? '미분류'} · {STATUS_LABELS[p.status]} · 재고 {stockText(p)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && products.length > 0 && !isMobile && (
        <>
          <table className="list-table">
            {/* 열 너비를 비율로 못 박는다. 안 그러면 페이지마다 내용 길이를 따라 열이 들썩인다. */}
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th aria-label="사진" />
                <th>이름</th>
                <th>카테고리</th>
                <th>가격</th>
                <th>상태</th>
                <th>재고</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr
                  key={p.id}
                  className="clickable-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => open(p.id)}
                  onKeyDown={(e) => onRowKey(e, p.id)}
                >
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td className="avatar-cell">
                    {/* 옆 칸이 이름을 말하므로 사진은 장식이다. */}
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="product-thumb" />
                    ) : (
                      <div className="product-thumb image-placeholder" />
                    )}
                  </td>
                  <td title={p.name}>{p.name}</td>
                  <td>{p.categoryName ?? '미분류'}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td>
                    <span className={p.status === 'SELLING' ? 'status-badge status-badge--selling' : 'status-badge'}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className={p.totalStock === 0 ? 'stock-out' : undefined}>{stockText(p)}</td>
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
