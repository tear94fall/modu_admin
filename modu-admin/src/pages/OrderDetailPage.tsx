import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { changeOrderStatus, getOrder, NEXT_STATUSES, type OrderDetail, ORDER_STATUS_LABELS, type OrderStatus } from '../api/orders'
import { validationMessage } from '../api/products'
import CopyButton from '../components/CopyButton'
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

  const next = NEXT_STATUSES[order.status]
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div>
      {backLink}
      <div className="detail-layout">
        <aside className="member-profile summary-card" aria-label="주문 정보">
          <div className="member-profile-cover member-profile-cover--empty" />
          <div className="member-profile-head">
            <span className="summary-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
                <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
              </svg>
            </span>
            <div className="member-profile-name">
              <h1 className="profile-username">주문 {order.orderNo}</h1>
            </div>
            <span className="service-badges">
              <span className={statusClass(order.status)}>{ORDER_STATUS_LABELS[order.status]}</span>
            </span>
          </div>

          <div className="member-profile-section">
            <h2 className="member-profile-section-title">결제 금액</h2>
            <div className="summary-figure">
              <span className="summary-figure-value">{formatPrice(order.paymentAmount)}</span>
              <span className="summary-figure-note">
                상품 {order.items.length}종 · {quantity}개
              </span>
            </div>
          </div>

          <dl className="member-profile-facts">
            <dt>주문번호</dt>
            <dd className="member-profile-id">
              <code>{order.orderNo}</code>
              <CopyButton text={order.orderNo} label="주문번호 복사" />
            </dd>
            <dt>주문자</dt>
            <dd className="member-profile-id">
              <code>{order.userId}</code>
              <CopyButton text={order.userId} label="주문자 ID 복사" />
            </dd>
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
          </dl>

          {(next.length > 0 || message || error) && (
            <div className="member-profile-section">
              <h2 className="member-profile-section-title">상태 변경</h2>
              {next.length > 0 && (
                <div className="summary-actions">
                  {next.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n === 'CANCELLED' ? 'btn btn--danger' : 'btn btn--primary'}
                      disabled={working}
                      onClick={() => change(n)}
                    >
                      {n === 'CANCELLED' ? '주문 취소' : `${ORDER_STATUS_LABELS[n]} 으로`}
                    </button>
                  ))}
                </div>
              )}
              {message && <p className="result-text">{message}</p>}
              {error && <p className="error-text">{error}</p>}
            </div>
          )}
        </aside>

        <div className="detail-main">
          <section className="section-card" aria-label="주문 상품">
            <div className="section-card-head">
              <h2 className="section-card-title">상품 ({order.items.length})</h2>
            </div>
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
            <div className="order-sum">
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
              <div className="order-total order-total--grand">
                <span>결제 금액</span>
                <strong>{formatPrice(order.paymentAmount)}</strong>
              </div>
            </div>
          </section>

          <section className="section-card" aria-label="배송 정보">
            <div className="section-card-head">
              <h2 className="section-card-title">배송 정보</h2>
            </div>
            <dl className="kv-grid">
              <dt>받는 사람</dt>
              <dd>
                {order.recipient} · {order.phone}
              </dd>
              <dt>배송지</dt>
              <dd>
                ({order.zipCode}) {order.address1} {order.address2 ?? ''}
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
