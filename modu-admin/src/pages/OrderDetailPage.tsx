import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  ACTOR_LABELS,
  CANCEL_REASONS,
  CARRIERS,
  type ChangeStatusInput,
  changeOrderStatus,
  getOrder,
  type OrderDetail,
  ORDER_STATUS_LABELS,
} from '../api/orders'
import { validationMessage } from '../api/products'
import CopyButton from '../components/CopyButton'
import OrderTimeline from '../components/OrderTimeline'
import Select from '../components/Select'
import { formatDateTime, formatPrice } from '../util/format'
import { statusClass } from './OrdersPage'

const REFUND_LABELS = { NONE: '', PENDING: '포인트 환불 보내는 중', DONE: '포인트 환불됨', FAILED: '포인트 환불 실패 — 확인 필요' } as const

/**
 * 주문 상세와 운영 처리. 결제완료면 배송 시작(택배사·송장)과 취소(사유)를, 배송중이면 배송 완료를 할 수 있다.
 * 배송 정보·취소/환불·처리 이력을 함께 보여 준다.
 */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 배송 시작 폼
  const [carrier, setCarrier] = useState<string>(CARRIERS[0])
  const [customCarrier, setCustomCarrier] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  // 취소 폼
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0])
  const [customReason, setCustomReason] = useState('')

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

  const apply = async (input: ChangeStatusInput, done: string) => {
    if (!id) return
    setMessage(null)
    setError(null)
    setWorking(true)
    try {
      const saved = await changeOrderStatus(id, input)
      setOrder(saved)
      setMessage(done)
    } catch (err) {
      setError(validationMessage(err) ?? '상태를 바꾸지 못했습니다')
    } finally {
      setWorking(false)
    }
  }
  const ship = (e: FormEvent) => {
    e.preventDefault()
    const c = carrier === '기타' ? customCarrier.trim() : carrier
    void apply({ status: 'SHIPPING', carrier: c, trackingNo: trackingNo.trim() }, '배송중으로 바꿨습니다')
  }
  const cancel = (e: FormEvent) => {
    e.preventDefault()
    if (!order) return
    const r = reason === '기타' ? customReason.trim() : reason
    if (!window.confirm(`주문 ${order.orderNo} 을 취소할까요? 재고·쿠폰·포인트가 돌아갑니다.\n사유: ${r}`)) return
    void apply({ status: 'CANCELLED', reason: r }, '주문을 취소했습니다')
  }
  const deliver = () => void apply({ status: 'DELIVERED' }, '배송완료로 바꿨습니다')

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

  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const refund = order.pointRefundStatus ?? 'NONE'

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
            {order.shippedAt && (
              <>
                <dt>배송 시작</dt>
                <dd>{formatDateTime(order.shippedAt)}</dd>
              </>
            )}
            {order.deliveredAt && (
              <>
                <dt>배송 완료</dt>
                <dd>{formatDateTime(order.deliveredAt)}</dd>
              </>
            )}
            {order.cancelledAt && (
              <>
                <dt>취소</dt>
                <dd>{formatDateTime(order.cancelledAt)}</dd>
              </>
            )}
          </dl>

          {(order.status === 'PAID' || order.status === 'SHIPPING' || message || error) && (
            <div className="member-profile-section" aria-label="처리">
              <h2 className="member-profile-section-title">처리</h2>
              {order.status === 'PAID' && (
                <>
                  <form className="op-form" onSubmit={ship} aria-label="배송 시작">
                    <div className="op-form-row">
                      <Select
                        aria-label="택배사"
                        value={carrier}
                        onChange={setCarrier}
                        options={[...CARRIERS.map((c) => ({ value: c, label: c })), { value: '기타', label: '기타(직접 입력)' }]}
                      />
                      {carrier === '기타' && (
                        <input aria-label="택배사 이름" placeholder="택배사 이름" maxLength={30} value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
                      )}
                      <input aria-label="송장번호" placeholder="송장번호" maxLength={40} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn--primary" disabled={working || trackingNo.trim() === '' || (carrier === '기타' && customCarrier.trim() === '')}>
                      배송 시작
                    </button>
                  </form>
                  <form className="op-form op-form--danger" onSubmit={cancel} aria-label="주문 취소">
                    <div className="op-form-row">
                      <Select
                        aria-label="취소 사유"
                        value={reason}
                        onChange={setReason}
                        options={[...CANCEL_REASONS.map((r) => ({ value: r, label: r })), { value: '기타', label: '기타(직접 입력)' }]}
                      />
                      {reason === '기타' && <input aria-label="취소 사유 입력" placeholder="사유" maxLength={200} value={customReason} onChange={(e) => setCustomReason(e.target.value)} />}
                    </div>
                    <button type="submit" className="btn btn--danger" disabled={working || (reason === '기타' && customReason.trim() === '')}>
                      주문 취소
                    </button>
                  </form>
                </>
              )}
              {order.status === 'SHIPPING' && (
                <div className="summary-actions">
                  <button type="button" className="btn btn--primary" disabled={working} onClick={deliver}>
                    배송완료로
                  </button>
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
              <h2 className="section-card-title">주문 상품</h2>
            </div>
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={item.id} className="order-item">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
                  <div className="order-item-body">
                    <Link to={`/products/${item.productId}`} className="order-item-name">
                      {item.productName}
                    </Link>
                    <span className="card-muted">{item.optionLabel}</span>
                  </div>
                  <div className="order-item-amount">
                    <span className="card-muted">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </span>
                    <strong>{formatPrice(item.lineAmount)}</strong>
                  </div>
                </li>
              ))}
            </ul>
            <div className="order-total">
              <div className="order-total-row">
                <span>상품 금액</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
              {(order.couponDiscount ?? 0) > 0 && (
                <div className="order-total-row">
                  <span>쿠폰 할인{order.couponName ? ` (${order.couponName})` : ''}</span>
                  <span>-{formatPrice(order.couponDiscount ?? 0)}</span>
                </div>
              )}
              {order.pointAmount > 0 && (
                <div className="order-total-row">
                  <span>포인트 사용</span>
                  <span>-{formatPrice(order.pointAmount)}</span>
                </div>
              )}
              <div className="order-total-row order-total-row--sum">
                <span>결제 금액</span>
                <strong>{formatPrice(order.paymentAmount)}</strong>
              </div>
            </div>
          </section>

          <section className="section-card" aria-label="배송 정보">
            <div className="section-card-head">
              <h2 className="section-card-title">배송 정보</h2>
              {order.trackingNo && <span className="card-muted">{order.status === 'DELIVERED' ? '배송 완료' : '배송 중'}</span>}
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
              {order.trackingNo && (
                <>
                  <dt>택배</dt>
                  <dd className="member-profile-id">
                    {order.carrier} <code>{order.trackingNo}</code>
                    <CopyButton text={order.trackingNo} label="송장번호 복사" />
                  </dd>
                </>
              )}
            </dl>
          </section>

          {order.status === 'CANCELLED' && (
            <section className="section-card section-card--cancel" aria-label="취소·환불">
              <div className="section-card-head">
                <h2 className="section-card-title">취소 · 환불</h2>
                <span className="card-muted">{order.cancelledBy ? `${ACTOR_LABELS[order.cancelledBy]} 취소` : ''}</span>
              </div>
              <dl className="kv-grid">
                <dt>사유</dt>
                <dd>{order.cancelReason ?? '(사유 없음)'}</dd>
                <dt>환불</dt>
                <dd>
                  결제 {formatPrice(order.paymentAmount)} 환불(모의)
                  {order.pointAmount > 0 && ` · ${REFUND_LABELS[refund] || `포인트 ${formatPrice(order.pointAmount)}`}`}
                  {(order.couponDiscount ?? 0) > 0 && ' · 쿠폰 반환됨'}
                </dd>
                <dt>재고</dt>
                <dd>주문 수량 {quantity}개 복구됨</dd>
              </dl>
            </section>
          )}

          <section className="section-card" aria-label="처리 이력">
            <div className="section-card-head">
              <h2 className="section-card-title">처리 이력</h2>
            </div>
            <OrderTimeline events={order.events ?? []} />
          </section>
        </div>
      </div>
    </div>
  )
}
