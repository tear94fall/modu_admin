import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { ORDER_STATUS_LABELS, type OrderStatus, type OrderSummary, searchOrders } from '../api/orders'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatDateTime, formatPrice } from '../util/format'

export function statusClass(status: OrderStatus): string {
  switch (status) {
    case 'PAID':
      return 'status-badge status-badge--selling'
    case 'SHIPPING':
      return 'status-badge status-badge--shipping'
    case 'DELIVERED':
      return 'status-badge status-badge--done'
    case 'CANCELLED':
      return 'status-badge status-badge--cancelled'
  }
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [page, setPage] = useState(0)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchOrders(searchTerm, page, { status })
      .then((result) => {
        if (cancelled) return
        setOrders(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('주문 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page, status])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword.trim())
  }
  const open = (id: number) => navigate(`/orders/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }
  const filtered = searchTerm !== '' || status !== null
  const title = (o: OrderSummary) => (o.itemCount > 1 ? `${o.firstItemName} 외 ${o.itemCount - 1}건` : o.firstItemName)

  return (
    <div>
      <h1>주문 관리</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="주문 검색" placeholder="주문번호 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>
      <div className="filter-row">
        <select
          aria-label="주문 상태"
          value={status ?? ''}
          onChange={(e) => {
            setPage(0)
            setStatus(e.target.value === '' ? null : (e.target.value as OrderStatus))
          }}
        >
          <option value="">전체 상태</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && orders.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '주문이 없습니다'}</p>}

      {!loading && !error && orders.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {orders.map((o, i) => (
              <li key={o.id}>
                <button type="button" className="card" onClick={() => open(o.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  {o.firstImageUrl ? <img src={o.firstImageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                  <span className="card-body">
                    <span className="card-title">{title(o)}</span>
                    <span className="card-line">
                      {formatPrice(o.totalAmount)} · <span className={statusClass(o.status)}>{ORDER_STATUS_LABELS[o.status]}</span>
                    </span>
                    <span className="card-line card-muted">
                      {o.orderNo} · {formatDateTime(o.createdAt ?? undefined)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && orders.length > 0 && !isMobile && (
        <>
          <table className="list-table">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th>주문번호</th>
                <th>상품</th>
                <th>금액</th>
                <th>상태</th>
                <th>주문일시</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} className="clickable-row" role="button" tabIndex={0} onClick={() => open(o.id)} onKeyDown={(e) => onRowKey(e, o.id)}>
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td>{o.orderNo}</td>
                  <td title={title(o)}>{title(o)}</td>
                  <td>{formatPrice(o.totalAmount)}</td>
                  <td>
                    <span className={statusClass(o.status)}>{ORDER_STATUS_LABELS[o.status]}</span>
                  </td>
                  <td>{formatDateTime(o.createdAt ?? undefined)}</td>
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
