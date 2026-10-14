import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import {
  type AdminPushCampaign,
  cancelPushCampaign,
  errorMessage,
  PUSH_STATUS_LABELS,
  type PushCampaignStatus,
  pushStatusClass,
  searchPushCampaigns,
  sendTimeText,
  targetText,
} from '../api/pushCampaigns'
import Pager from '../components/Pager'
import { PushFunnelCompact } from '../components/PushFunnel'
import { useIsMobile } from '../hooks/useIsMobile'

const STATUS_FILTERS: { label: string; value: PushCampaignStatus | null }[] = [
  { label: '전체', value: null },
  { label: '예약', value: 'SCHEDULED' },
  { label: '보내는 중', value: 'SENDING' },
  { label: '보냄', value: 'SENT' },
  { label: '취소', value: 'CANCELED' },
  { label: '실패', value: 'FAILED' },
]


/** 커머스 푸시 캠페인 목록. 상태로 거르고 제목으로 찾는다. 서버가 보낼 시각 최신순으로 준다. */
export default function PushCampaignsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState<PushCampaignStatus | null>(null)
  const [page, setPage] = useState(0)
  const [campaigns, setCampaigns] = useState<AdminPushCampaign[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchPushCampaigns(searchTerm, page, { status })
      .then((result) => {
        if (cancelled) return
        setCampaigns(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, '푸시 캠페인 목록을 불러오지 못했습니다'))
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
  const open = (id: number) => navigate(`/push-campaigns/${id}`)
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(id)
    }
  }

  const stop = (e: MouseEvent) => e.stopPropagation()
  const onCancel = async (id: number) => {
    setCancelingId(id)
    setActionError(null)
    try {
      const updated = await cancelPushCampaign(id)
      setCampaigns((list) => list.map((c) => (c.id === id ? updated : c)))
      setConfirmingId(null)
    } catch (err) {
      setActionError(errorMessage(err, '예약을 취소하지 못했습니다'))
    } finally {
      setCancelingId(null)
    }
  }

  /** 예약 줄의 취소 버튼. 누르면 같은 자리에서 한 번 더 묻는다. */
  const cancelControl = (c: AdminPushCampaign) => {
    if (c.status !== 'SCHEDULED') return null
    if (confirmingId !== c.id)
      return (
        <button type="button" className="btn btn--danger btn--sm" aria-label={`${c.title} 예약 취소`} onClick={(e) => {
            stop(e)
            setConfirmingId(c.id)
          }}>
          예약 취소
        </button>
      )
    return (
      <span className="confirm-inline" role="group" aria-label="예약 취소 확인" onClick={stop}>
        <span>취소할까요?</span>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => onCancel(c.id)} disabled={cancelingId === c.id}>
          취소 확인
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmingId(null)} disabled={cancelingId === c.id}>
          아니요
        </button>
      </span>
    )
  }

  const filtered = searchTerm !== '' || status !== null

  return (
    <div>
      <h1>푸시 캠페인</h1>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" aria-label="제목 검색" placeholder="제목 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
        <Link to="/push-campaigns/new" className="btn btn--primary">
          새로 만들기
        </Link>
      </div>
      <div className="sort-chips" role="group" aria-label="상태">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={status === f.value ? 'sort-chip active' : 'sort-chip'}
            aria-pressed={status === f.value}
            onClick={() => {
              setPage(0)
              setStatus(f.value)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="form-hint">보낸 시각(예약은 예약 시각)은 한국 시간입니다. 발송 결과의 % 는 열람률(열어 봄 ÷ 성공)입니다.</p>

      {actionError && <p className="error-text">{actionError}</p>}
      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && campaigns.length === 0 && <p>{filtered ? '검색 결과가 없습니다' : '만든 푸시 캠페인이 없습니다'}</p>}

      {!loading && !error && campaigns.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {campaigns.map((c, i) => (
              <li key={c.id} className="push-card-item">
                <button type="button" className="card" onClick={() => open(c.id)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <span className="card-body">
                    <span className="card-title">{c.title}</span>
                    <span className="card-line">
                      <span className={pushStatusClass(c.status)}>{PUSH_STATUS_LABELS[c.status]}</span> {targetText(c)}
                    </span>
                    <span className="card-line card-muted">{sendTimeText(c)}</span>
                    <span className="card-line card-funnel">
                      <PushFunnelCompact c={c} />
                    </span>
                  </span>
                </button>
                {c.status === 'SCHEDULED' && <div className="push-card-actions">{cancelControl(c)}</div>}
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && campaigns.length > 0 && !isMobile && (
        <>
          <div className="table-scroll">
            <table className="list-table push-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="num-cell">번호</th>
                  <th>제목</th>
                  <th>대상</th>
                  <th className="push-time-cell">보낼 시각</th>
                  <th>상태</th>
                  <th className="push-funnel-cell">발송 결과</th>
                  <th className="push-actions-head" aria-label="관리" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.id} className="clickable-row" role="button" tabIndex={0} onClick={() => open(c.id)} onKeyDown={(e) => onRowKey(e, c.id)}>
                    <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                    <td title={c.title}>{c.title}</td>
                    <td title={targetText(c)}>{targetText(c)}</td>
                    <td className="push-time-cell">{sendTimeText(c)}</td>
                    <td>
                      <span className={pushStatusClass(c.status)}>{PUSH_STATUS_LABELS[c.status]}</span>
                    </td>
                    <td className="push-funnel-cell">
                      <PushFunnelCompact c={c} />
                    </td>
                    <td className="push-actions-cell">{cancelControl(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
