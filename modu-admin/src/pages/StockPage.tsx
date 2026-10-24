import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/pushCampaigns'
import {
  coverageText,
  getStockAlerts,
  HIGH_MAX,
  HIGH_MIN,
  LOW_MAX,
  LOW_MIN,
  rememberCriteria,
  type StockAlerts,
  type StockCriteria,
  type StockSku,
  storedCriteria,
} from '../api/stock'

const num = (n: number) => n.toLocaleString('ko-KR')

type Kind = 'SOLD_OUT' | 'LOW' | 'OVER'
type Tab = 'ALL' | Kind

const KIND_LABEL: Record<Kind, string> = { SOLD_OUT: '품절', LOW: '재고 부족', OVER: '재고 과다' }
const KIND_TONE: Record<Kind, string> = { SOLD_OUT: 'rose', LOW: 'amber', OVER: 'sky' }

/** 표의 한 줄 = 상품 하나 × 구분 하나. 옵션은 칩으로 모은다(같은 상품이 옵션마다 줄로 반복되지 않게). */
interface Row {
  key: string
  kind: Kind
  productId: number
  name: string
  imageUrl: string | null
  wishCount: number
  /** 옵션(SKU)별 재고. 옵션 없는 상품은 label 이 빈 칩 하나. 품절 상품은 비어 있다(전체 0). */
  skus: { skuId: number; label: string; stock: number }[]
  skuCount: number
  /** 이 줄에 해당하는 재고 합(옵션 없는 상품이면 그 재고) */
  stock: number
  sold: number
}

function skuRows(kind: Kind, items: StockSku[]): Row[] {
  const byProduct = new Map<number, Row>()
  for (const s of items) {
    const row = byProduct.get(s.productId)
    if (row) {
      row.skus.push({ skuId: s.skuId, label: s.optionLabel, stock: s.stock })
      row.stock += s.stock
      row.sold += s.sold
      row.skuCount += 1
    } else {
      byProduct.set(s.productId, {
        key: `${kind}:${s.productId}`,
        kind,
        productId: s.productId,
        name: s.productName,
        imageUrl: s.imageUrl,
        wishCount: s.wishCount,
        skus: [{ skuId: s.skuId, label: s.optionLabel, stock: s.stock }],
        skuCount: 1,
        stock: s.stock,
        sold: s.sold,
      })
    }
  }
  return [...byProduct.values()]
}

function toRows(data: StockAlerts): Row[] {
  const soldOut: Row[] = data.soldOut.map((p) => ({
    key: `SOLD_OUT:${p.productId}`,
    kind: 'SOLD_OUT',
    productId: p.productId,
    name: p.name,
    imageUrl: p.imageUrl,
    wishCount: p.wishCount,
    skus: [],
    skuCount: p.skuCount,
    stock: 0,
    sold: p.sold,
  }))
  return [...soldOut, ...skuRows('LOW', data.lowStock), ...skuRows('OVER', data.overstock)]
}

/** 기준이 바뀌면 key 로 다시 마운트돼 목록을 새로 읽는다(effect 안에서 setState 로 비우지 않으려고). */
export default function StockPage() {
  const [criteria, setCriteria] = useState<StockCriteria>(storedCriteria)
  const apply = (c: StockCriteria) => {
    setCriteria(c)
    rememberCriteria(c)
  }
  return <StockBoard key={`${criteria.low ?? '-'}:${criteria.high ?? '-'}`} criteria={criteria} onCriteria={apply} />
}

function StockBoard({ criteria, onCriteria }: { criteria: StockCriteria; onCriteria: (c: StockCriteria) => void }) {
  const [data, setData] = useState<StockAlerts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('ALL')
  const [lowDraft, setLowDraft] = useState(criteria.low === undefined ? '' : String(criteria.low))
  const [highDraft, setHighDraft] = useState(criteria.high === undefined ? '' : String(criteria.high))

  useEffect(() => {
    let cancelled = false
    getStockAlerts(criteria)
      .then((r) => {
        if (cancelled) return
        setData(r)
        setLowDraft(String(r.low))
        setHighDraft(String(r.high))
      })
      .catch((err) => !cancelled && setError(errorMessage(err, '재고 정보를 불러오지 못했습니다')))
  }, [])

  const low = Number(lowDraft)
  const high = Number(highDraft)
  const validLow = lowDraft !== '' && Number.isInteger(low) && low >= LOW_MIN && low <= LOW_MAX
  const validHigh = highDraft !== '' && Number.isInteger(high) && high >= HIGH_MIN && high <= HIGH_MAX && (!validLow || high > low)
  const unchanged = data !== null && low === data.low && high === data.high
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!validLow || !validHigh || unchanged) return
    onCriteria({ low, high })
  }

  const rows = data ? toRows(data) : []
  const counts: Record<Kind, number> = {
    SOLD_OUT: rows.filter((r) => r.kind === 'SOLD_OUT').length,
    LOW: rows.filter((r) => r.kind === 'LOW').length,
    OVER: rows.filter((r) => r.kind === 'OVER').length,
  }
  const visible = tab === 'ALL' ? rows : rows.filter((r) => r.kind === tab)
  const loading = !data && !error

  return (
    <div className="page stock-page">
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-head-title">
            <h1>재고</h1>
          </div>
          <p className="page-head-sub">
            {data ? `판매 중 ${num(data.sellingProducts)}종 · 최근 ${data.salesDays}일 판매량 기준` : '판매 중 상품의 품절·부족·과다 재고를 한 표에서 봅니다'}
          </p>
        </div>
        <form className="page-head-actions stock-criteria" onSubmit={submit} aria-label="기준 재고">
          <label className="stock-criterion">
            <span className="stock-criterion-label">부족</span>
            <input type="number" inputMode="numeric" min={LOW_MIN} max={LOW_MAX} value={lowDraft} onChange={(e) => setLowDraft(e.target.value)} aria-label="부족 기준" aria-invalid={lowDraft !== '' && !validLow} />
            <span className="stock-criterion-unit">개 이하</span>
          </label>
          <label className="stock-criterion">
            <span className="stock-criterion-label">과다</span>
            <input type="number" inputMode="numeric" min={HIGH_MIN} max={HIGH_MAX} value={highDraft} onChange={(e) => setHighDraft(e.target.value)} aria-label="과다 기준" aria-invalid={highDraft !== '' && !validHigh} />
            <span className="stock-criterion-unit">개 이상</span>
          </label>
          <button type="submit" className="btn btn--primary" disabled={!validLow || !validHigh || unchanged}>
            적용
          </button>
        </form>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {data && (
        <>
          <div className="stock-tiles" role="tablist" aria-label="재고 구분">
            <TabTile active={tab === 'ALL'} onClick={() => setTab('ALL')} tone="indigo" label="전체 경고" value={`${num(rows.length)}건`} foot="품절 · 부족 · 과다" />
            <TabTile active={tab === 'SOLD_OUT'} onClick={() => setTab('SOLD_OUT')} tone="rose" label="품절" value={`${num(counts.SOLD_OUT)}종`} foot="모든 옵션 재고 0" empty={counts.SOLD_OUT === 0} />
            <TabTile active={tab === 'LOW'} onClick={() => setTab('LOW')} tone="amber" label="재고 부족" value={`${num(counts.LOW)}종`} foot={`옵션 ${num(data.lowStock.length)}건 · ${num(data.low)}개 이하`} empty={counts.LOW === 0} />
            <TabTile active={tab === 'OVER'} onClick={() => setTab('OVER')} tone="sky" label="재고 과다" value={`${num(counts.OVER)}종`} foot={`옵션 ${num(data.overstock.length)}건 · ${num(data.high)}개 이상`} empty={counts.OVER === 0} />
          </div>

          <section className="section-card stock-table-card" aria-label={tab === 'ALL' ? '재고 경고 목록' : `${KIND_LABEL[tab]} 목록`}>
            {visible.length === 0 ? (
              <div className="stock-empty">
                <span className="stock-empty-mark" aria-hidden="true">
                  ✓
                </span>
                <p className="card-muted">{tab === 'ALL' ? '경고가 없습니다. 모든 상품 재고가 기준 안에 있어요.' : `${KIND_LABEL[tab]}인 상품이 없습니다`}</p>
              </div>
            ) : (
              <div className="card-table-wrap">
                <table className="card-table stock-table">
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>상품</th>
                      <th>구분</th>
                      <th>옵션 · 재고</th>
                      <th className="num-cell">{data.salesDays}일 판매</th>
                      <th className="num-cell">찜</th>
                      <th aria-label="처리" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <StockRow key={r.key} row={r} data={data} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function TabTile({ active, onClick, tone, label, value, foot, empty }: { active: boolean; onClick: () => void; tone: string; label: string; value: string; foot: string; empty?: boolean }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={`hero-tile hero-tile--${tone} stock-tile${active ? ' stock-tile--active' : ''}${empty ? ' hero-tile--empty' : ''}`} onClick={onClick}>
      <span className="hero-tile-label">{label}</span>
      <span className="hero-tile-value">{value}</span>
      <span className="hero-tile-foot">{foot}</span>
    </button>
  )
}

/** 재고 칩 색: 품절 0 은 빨강, 부족 기준 절반 이하는 진한 주황, 부족은 주황, 과다는 하늘색. */
function chipClass(kind: Kind, stock: number, low: number): string {
  if (kind === 'OVER') return 'sku-chip sku-chip--over'
  if (stock === 0) return 'sku-chip sku-chip--out'
  if (stock * 2 <= low) return 'sku-chip sku-chip--hot'
  return 'sku-chip'
}

function StockRow({ row, data }: { row: Row; data: StockAlerts }) {
  const coverage = coverageText(row.stock, row.sold, data.salesDays)
  const soldText = row.sold === 0 ? '최근 판매 없음' : coverage
  return (
    <tr>
      <td className="stock-product-cell">
        {row.imageUrl ? <img src={row.imageUrl} alt="" className="product-thumb" /> : <span className="product-thumb image-placeholder" />}
        <div className="stock-product">
          <Link to={`/products/${row.productId}`} className="stock-row-name">
            {row.name}
          </Link>
          <span className="card-muted">{row.kind === 'SOLD_OUT' ? `옵션 ${num(row.skuCount)}개 전부 0` : `옵션 ${num(row.skuCount)}건 해당`}</span>
        </div>
      </td>
      <td>
        <span className={`status-badge status-badge--${KIND_TONE[row.kind]}`}>{KIND_LABEL[row.kind]}</span>
      </td>
      <td className="stock-skus-cell">
        {row.kind === 'SOLD_OUT' ? (
          <span className="sku-chip sku-chip--out">
            <span className="sku-chip-stock">품절</span>
          </span>
        ) : (
          <div className="sku-chips">
            {row.skus.map((s) => (
              <span key={s.skuId} className={chipClass(row.kind, s.stock, data.low)}>
                {s.label && <span className="sku-chip-label">{s.label}</span>}
                <span className="sku-chip-stock">{s.stock === 0 ? '품절' : `${num(s.stock)}개`}</span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="num-cell stock-sold-cell">
        <span className="stock-sold">{num(row.sold)}개</span>
        {soldText && <span className={`stock-coverage${row.sold === 0 ? ' stock-coverage--none' : ''}`}>{soldText}</span>}
      </td>
      <td className="num-cell">{num(row.wishCount)}</td>
      <td className="stock-action-cell">
        <Link to={`/products/${row.productId}`} className="btn btn--secondary btn--sm">
          {row.kind === 'OVER' ? '상품 열기' : '재고 채우기'}
        </Link>
      </td>
    </tr>
  )
}
