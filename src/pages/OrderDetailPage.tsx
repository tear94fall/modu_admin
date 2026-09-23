import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { changeOrderStatus, getOrder, NEXT_STATUSES, type OrderDetail, ORDER_STATUS_LABELS, type OrderStatus } from '../api/orders'
import { validationMessage } from '../api/products'
import { formatDateTime, formatPrice } from '../util/format'
import { statusClass } from './OrdersPage'

/** 주문 상세와 상태 변경. 허용된 다음 상태만 버튼으로 보이고, 취소는 확인을 거친다. */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getOrder(id)
      .then((o) => {
        if (!cancelled) setOrder(o)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError('주문을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const change = async (next: OrderStatus) => {
    if (!id || !order) return
    if (next === 'CANCELLED' && !window.confirm(`주문 ${order.orderNo} 을 취소할까요? 재고가 복구됩니다.`)) return
    setMessage(null)
    setError(null)
    setWorking(true)
    try {
      const saved = await changeOrderStatus(id, next)
      setOrder(saved)
      setMessage(`${ORDER_STATUS_LABELS[next]} 으로 바꿨습니다`)
    } catch (err) {
      setError(validationMessage(err) ?? '상태를 바꾸지 못했습니다')
    } finally {
      setWorking(false)
    }
  }

  const backLink = (
    <Link to="/orders" className="back-link">
      ← 주문 목록
    </Link>
  )
  if (loading) return <p>불러오는 중...</p>
  if (notFound)
    return (
      <div>
        {backLink}
        <p>주문을 찾을 수 없습니다</p>
      </div>
    )
  if (loadError || !order) return <p className="error-text">{loadError}</p>

  return (
    <div>
      {backLink}
      <h1>주문 {order.orderNo}</h1>
      <div className="form-card form-card--wide">
        <div className="form-section">
          <div className="order-status-row">
            <span className={statusClass(order.status)}>{ORDER_STATUS_LABELS[order.status]}</span>
            <span className="order-actions">
              {NEXT_STATUSES[order.status].map((next) => (
                <button
                  key={next}
                  type="button"
                  className={next === 'CANCELLED' ? 'btn btn--danger btn--sm' : 'btn btn--primary btn--sm'}
                  disabled={working}
                  onClick={() => change(next)}
                >
                  {next === 'CANCELLED' ? '주문 취소' : `${ORDER_STATUS_LABELS[next]} 으로`}
                </button>
              ))}
            </span>
          </div>
          <dl className="detail-grid">
            <dt>주문자</dt>
            <dd>{order.userId}</dd>
            <dt>결제</dt>
            <dd>
              {order.paymentMethod} · {formatDateTime(order.paidAt)}
            </dd>
            {order.cancelledAt && (
              <>
                <dt>취소</dt>
                <dd>{formatDateTime(order.cancelledAt ?? undefined)}</dd>
              </>
            )}
            <dt>받는 사람</dt>
            <dd>
              {order.recipient} · {order.phone}
            </dd>
            <dt>배송지</dt>
            <dd>
              ({order.zipCode}) {order.address1} {order.address2 ?? ''}
            </dd>
          </dl>
        </div>
        <div className="form-section">
          <h2 className="form-heading">상품</h2>
          <ul className="order-items">
            {order.items.map((item) => (
              <li key={item.id} className="order-item">
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                <span className="order-item-body">
                  <span className="card-title">{item.productName}</span>
                  {item.optionLabel && <span className="card-line card-muted">{item.optionLabel}</span>}
                  <span className="card-line">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </span>
                </span>
                <span className="order-item-amount">{formatPrice(item.lineAmount)}</span>
              </li>
            ))}
          </ul>
          <div className="order-total muted">
            <span>상품 금액</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
          {order.pointAmount > 0 && (
            <div className="order-total muted">
              <span>포인트 사용{order.status === 'CANCELLED' ? ' (환불됨)' : ''}</span>
              <span>-{formatPrice(order.pointAmount)}</span>
            </div>
          )}
          <div className="order-total">
            <span>결제 금액</span>
            <strong>{formatPrice(order.paymentAmount)}</strong>
          </div>
        </div>
      </div>
      {message && <p className="result-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
