import { useState } from 'react'
import { CARRIERS, type OrderSummary, type ShipOrderOutcome, shipOrders } from '../api/orders'
import { errorMessage } from '../api/pushCampaigns'
import Modal from './Modal'
import Select from './Select'

/**
 * 목록에서 고른 결제완료 주문들을 한 번에 배송중으로. 택배사는 한 번 고르고(건마다 바꿀 수 있음) 송장번호는 건마다 적는다.
 * 보낸 뒤 건별 결과를 그 자리에 보여 주고, 닫으면 부모가 목록을 다시 읽는다.
 */
export default function OrderShipModal({ orders, onClose, onDone }: { orders: OrderSummary[]; onClose: () => void; onDone: () => void }) {
  const [carrier, setCarrier] = useState<string>(CARRIERS[0])
  const [customCarrier, setCustomCarrier] = useState('')
  const [rows, setRows] = useState(orders.map((o) => ({ order: o, trackingNo: '', carrier: '' })))
  const [results, setResults] = useState<ShipOrderOutcome[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const effectiveCarrier = (row: { carrier: string }) => row.carrier || (carrier === '기타' ? customCarrier.trim() : carrier)
  const ready = rows.every((r) => r.trackingNo.trim() !== '' && effectiveCarrier(r) !== '')

  const submit = async () => {
    setError(null)
    setWorking(true)
    try {
      const res = await shipOrders(rows.map((r) => ({ orderId: r.order.id, carrier: effectiveCarrier(r), trackingNo: r.trackingNo.trim() })))
      setResults(res.results)
    } catch (err) {
      setError(errorMessage(err, '배송 처리를 하지 못했습니다'))
    } finally {
      setWorking(false)
    }
  }
  const resultOf = (id: number) => results?.find((r) => r.orderId === id)
  const okCount = results?.filter((r) => r.ok).length ?? 0

  return (
    <Modal title={`배송 처리 (${orders.length}건)`} onClose={results ? onDone : onClose} wide>
      {!results && (
        <div className="ship-carrier">
          <label htmlFor="ship-carrier">택배사</label>
          <Select
            id="ship-carrier"
            aria-label="택배사"
            value={carrier}
            onChange={setCarrier}
            options={[...CARRIERS.map((c) => ({ value: c, label: c })), { value: '기타', label: '기타(직접 입력)' }]}
          />
          {carrier === '기타' && <input aria-label="택배사 이름" placeholder="택배사 이름" maxLength={30} value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />}
        </div>
      )}
      <table className="data-table ship-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>상품</th>
            <th>송장번호</th>
            {results && <th>결과</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const res = resultOf(r.order.id)
            return (
              <tr key={r.order.id}>
                <td>{r.order.orderNo}</td>
                <td>{r.order.itemCount > 1 ? `${r.order.firstItemName} 외 ${r.order.itemCount - 1}건` : r.order.firstItemName}</td>
                <td>
                  {results ? (
                    r.trackingNo
                  ) : (
                    <input
                      aria-label={`${r.order.orderNo} 송장번호`}
                      placeholder="송장번호"
                      maxLength={40}
                      value={r.trackingNo}
                      onChange={(e) => setRows((prev) => prev.map((p, j) => (j === i ? { ...p, trackingNo: e.target.value } : p)))}
                    />
                  )}
                </td>
                {results && <td className={res?.ok ? 'result-text' : 'error-text'}>{res ? (res.ok ? '배송중' : (res.message ?? '실패')) : '-'}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p className="error-text">{error}</p>}
      <div className="modal-actions">
        {results ? (
          <>
            <span className="card-muted">{okCount}건 처리됨{okCount < results.length ? ` · ${results.length - okCount}건 실패` : ''}</span>
            <button type="button" className="btn btn--primary" onClick={onDone}>
              닫기
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose} disabled={working}>
              취소
            </button>
            <button type="button" className="btn btn--primary" onClick={submit} disabled={!ready || working}>
              {working ? '처리 중…' : `${rows.length}건 배송 시작`}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
