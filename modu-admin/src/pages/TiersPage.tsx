import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { discountLabel, searchCoupons, type CouponSummary } from '../api/coupons'
import { errorMessage } from '../api/pushCampaigns'
import {
  type AdminTier,
  getTierRuns,
  getTiers,
  HEX_COLOR,
  MAX_EARN_RATE,
  RUN_POLL_MS,
  countsText,
  RUN_REASON_LABELS,
  RUN_STATUS_LABELS,
  runStatusClass,
  startTierRun,
  type TierCoupon,
  type TierDraft,
  type TierRun,
  toDraft,
  toTierInputs,
  updateTiers,
  validateTiers,
} from '../api/tiers'
import Pager from '../components/Pager'
import TierBadge from '../components/TierBadge'
import { formatUtcDateTime } from '../util/timeZone'

const kst = (v: string | null) => formatUtcDateTime(v, 'Asia/Seoul') || '-'
const num = (n: number) => (n ?? 0).toLocaleString('ko-KR')

/** 등급 한 줄의 쿠폰 찾기. 어드민 쿠폰 목록을 이름·코드로 찾아 붙인다. */
function TierCouponSearch({ tierName, selected, onAdd, onClose }: { tierName: string; selected: TierCoupon[]; onAdd: (c: TierCoupon) => void; onClose: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CouponSummary[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedIds = new Set(selected.map((c) => c.id))

  const onSearch = async () => {
    setSearching(true)
    setError(null)
    try {
      setResults((await searchCoupons(keyword.trim(), 0)).content)
    } catch {
      setError('쿠폰을 찾지 못했습니다')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="tier-coupon-search">
      <div className="inline-form">
        <input
          type="text"
          aria-label={`${tierName} 쿠폰 검색`}
          placeholder="쿠폰 이름·코드로 찾기 (비우면 최근 쿠폰)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSearch()
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={onSearch} disabled={searching}>
          쿠폰 찾기
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          닫기
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {results && results.length === 0 && <p className="form-hint">찾은 쿠폰이 없습니다</p>}
      {results && results.length > 0 && (
        <ul className="image-list" aria-label={`${tierName} 쿠폰 검색 결과`}>
          {results.map((c) => (
            <li key={c.id} className="image-item">
              <span className="image-url" title={c.name}>
                <strong>{c.name}</strong> · {discountLabel(c)}
                {!c.active && <span className="status-badge status-badge--cancelled"> 비활성</span>}
              </span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                aria-label={`${c.name} 추가`}
                disabled={selectedIds.has(c.id)}
                onClick={() => onAdd({ id: c.id, name: c.name, discountLabel: discountLabel(c) })}
              >
                {selectedIds.has(c.id) ? '추가됨' : '추가'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 커머스 > 회원 등급. 4개 등급의 이름·색·기준 금액·적립률·매월 쿠폰을 고치고, 산정 이력을 보고, 지금 다시 산정한다. */
export default function TiersPage() {
  const [tiers, setTiers] = useState<AdminTier[] | null>(null)
  const [drafts, setDrafts] = useState<TierDraft[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  const [runs, setRuns] = useState<TierRun[]>([])
  const [runsPage, setRunsPage] = useState(0)
  const [runsTotalPages, setRunsTotalPages] = useState(0)
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [runsReload, setRunsReload] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [starting, setStarting] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTiers()
      .then((list) => {
        if (cancelled) return
        setTiers(list)
        setDrafts(list.map(toDraft))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, '회원 등급을 불러오지 못했습니다'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setRunsLoading(true)
    setRunsError(null)
    getTierRuns(runsPage)
      .then((p) => {
        if (cancelled) return
        setRuns(p.content)
        setRunsTotalPages(p.totalPages)
      })
      .catch((err) => {
        if (!cancelled) setRunsError(errorMessage(err, '산정 이력을 불러오지 못했습니다'))
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [runsPage, runsReload])

  // 산정은 서버가 따로 돌린다. 산정 중인 줄이 있는 동안 2초마다 목록을 다시 읽는다.
  const anyRunning = runs.some((r) => r.status === 'RUNNING')
  useEffect(() => {
    if (!anyRunning) return
    const timer = setInterval(() => {
      getTierRuns(runsPage)
        .then((p) => {
          setRuns(p.content)
          setRunsTotalPages(p.totalPages)
        })
        .catch(() => {})
    }, RUN_POLL_MS)
    return () => clearInterval(timer)
  }, [anyRunning, runsPage])

  // 산정이 끝나면 등급별 고객 수가 바뀐다. 고치던 값은 두고 고객 수만 새로 읽는다.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !anyRunning) {
      getTiers()
        .then(setTiers)
        .catch(() => {})
    }
    wasRunning.current = anyRunning
  }, [anyRunning])

  const baseline = tiers ? JSON.stringify(tiers.map(toDraft)) : ''
  const dirty = tiers !== null && JSON.stringify(drafts) !== baseline
  const problem = validateTiers(drafts)

  const edit = (code: string, patch: Partial<TierDraft>) => {
    setSaved(false)
    setDrafts((list) => list.map((d) => (d.code === code ? { ...d, ...patch } : d)))
  }

  const onSave = async () => {
    if (problem) {
      setSaveError(problem)
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const list = await updateTiers(toTierInputs(drafts))
      setTiers(list)
      setDrafts(list.map(toDraft))
      setSaved(true)
      setPickerFor(null)
    } catch (err) {
      setSaveError(errorMessage(err, '저장하지 못했습니다'))
    } finally {
      setSaving(false)
    }
  }

  const onStartRun = async () => {
    setStarting(true)
    setRunError(null)
    try {
      const run = await startTierRun()
      setConfirming(false)
      if (run) setRuns((list) => [run, ...list.filter((r) => r.id !== run.id)])
      if (runsPage !== 0) setRunsPage(0)
      else setRunsReload((n) => n + 1)
    } catch (err) {
      const fallback = err instanceof ApiError && err.status === 409 ? '이미 산정 중입니다' : '산정을 시작하지 못했습니다'
      setRunError(errorMessage(err, fallback))
    } finally {
      setStarting(false)
    }
  }

  const countOf = (code: string) => tiers?.find((t) => t.code === code)?.customerCount ?? 0

  return (
    <div>
      <h1>회원 등급</h1>
      <p className="form-hint tier-rule">
        매월 1일 0시 10분(한국 시간)에 지난 6개월 배송 완료 금액(쿠폰·포인트를 뺀 결제 금액)으로 등급을 다시 정하고, 등급별 매월 쿠폰을 발급합니다. 적립률은 배송 완료 때
        그 고객의 등급으로 계산합니다.
      </p>

      {loadError && <p className="error-text">{loadError}</p>}
      {!tiers && !loadError && <p>불러오는 중...</p>}

      {tiers && (
        <section className="tier-editor" aria-label="등급 설정">
          <div className="table-scroll">
            <table className="tier-table">
              <thead>
                <tr>
                  <th>등급</th>
                  <th>이름</th>
                  <th>색</th>
                  <th>기준 금액</th>
                  <th>적립률</th>
                  <th>매월 쿠폰</th>
                  <th className="amount-cell">고객</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => {
                  const label = d.name.trim() || d.code
                  const colorOk = HEX_COLOR.test(d.color.trim())
                  return [
                    <tr key={d.code}>
                      <td>
                        <TierBadge tier={{ name: label, color: d.color.trim() }} />
                        <div className="card-muted tier-code">{d.code}</div>
                      </td>
                      <td>
                        <input className="tier-name-input" aria-label={`${d.code} 이름`} value={d.name} maxLength={20} onChange={(e) => edit(d.code, { name: e.target.value })} />
                      </td>
                      <td>
                        <span className="tier-color">
                          <input
                            type="color"
                            className="color-input"
                            aria-label={`${label} 색 고르기`}
                            value={colorOk ? d.color.trim().toLowerCase() : '#64748b'}
                            onChange={(e) => edit(d.code, { color: e.target.value.toUpperCase() })}
                          />
                          <input className="tier-hex-input" aria-label={`${label} 색`} maxLength={7} value={d.color} onChange={(e) => edit(d.code, { color: e.target.value })} />
                        </span>
                      </td>
                      <td>
                        <span className="tier-unit-input">
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            inputMode="numeric"
                            aria-label={`${label} 기준 금액`}
                            value={d.minAmount}
                            disabled={i === 0 && d.minAmount === '0'}
                            onChange={(e) => edit(d.code, { minAmount: e.target.value })}
                          />
                          <span>원 이상</span>
                        </span>
                      </td>
                      <td>
                        <span className="tier-unit-input tier-unit-input--rate">
                          <input
                            type="number"
                            min={0}
                            max={MAX_EARN_RATE}
                            step={1}
                            inputMode="numeric"
                            aria-label={`${label} 적립률`}
                            value={d.earnRate}
                            onChange={(e) => edit(d.code, { earnRate: e.target.value })}
                          />
                          <span>%</span>
                        </span>
                      </td>
                      <td>
                        <span className="tier-coupons" aria-label={`${label} 매월 쿠폰`}>
                          {d.coupons.map((c) => (
                            <span key={c.id} className="tier-coupon-chip">
                              {c.name}
                              {c.discountLabel && <span className="card-muted"> · {c.discountLabel}</span>}
                              <button
                                type="button"
                                className="tier-coupon-remove"
                                aria-label={`${label}에서 ${c.name} 빼기`}
                                onClick={() => edit(d.code, { coupons: d.coupons.filter((x) => x.id !== c.id) })}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <button type="button" className="btn btn--secondary btn--sm" aria-label={`${label} 쿠폰 추가`} onClick={() => setPickerFor(pickerFor === d.code ? null : d.code)}>
                            + 쿠폰
                          </button>
                        </span>
                      </td>
                      <td className="amount-cell">{num(countOf(d.code))}명</td>
                    </tr>,
                    pickerFor === d.code && (
                      <tr key={`${d.code}-picker`} className="rule-edit-row">
                        <td colSpan={7}>
                          <TierCouponSearch
                            tierName={label}
                            selected={d.coupons}
                            onAdd={(c) => edit(d.code, { coupons: [...d.coupons, c] })}
                            onClose={() => setPickerFor(null)}
                          />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
          <p className="form-hint">
            가장 낮은 등급은 0원부터, 위 등급일수록 기준 금액이 커야 합니다. 적립률은 0~{MAX_EARN_RATE}%. 매월 쿠폰은 그 달 산정 때 동의한 고객에게 한 번씩 발급됩니다.
          </p>
          <div className="tier-actions">
            {dirty && problem && <span className="error-text">{problem}</span>}
            {saveError && <span className="error-text">{saveError}</span>}
            {saved && !dirty && <span className="result-text">저장했습니다</span>}
            <button type="button" className="btn btn--ghost" disabled={!dirty || saving} onClick={() => {
                setDrafts(tiers.map(toDraft))
                setSaveError(null)
              }}>
              되돌리기
            </button>
            <button type="button" className="btn btn--primary" disabled={!dirty || saving} onClick={onSave}>
              저장
            </button>
          </div>
        </section>
      )}

      <div className="tier-runs-head">
        <h2>산정 이력</h2>
        {!confirming && (
          <button type="button" className="btn btn--secondary" disabled={anyRunning || starting} onClick={() => setConfirming(true)}>
            {anyRunning ? '산정 중...' : '지금 다시 산정'}
          </button>
        )}
        {confirming && (
          <span className="confirm-inline" role="group" aria-label="다시 산정 확인">
            <span>모든 고객의 등급을 지금 다시 산정할까요? 이번 달 등급 쿠폰을 아직 보내지 않았다면 함께 발급합니다.</span>
            <button type="button" className="btn btn--primary" onClick={onStartRun} disabled={starting}>
              산정 시작
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={starting}>
              아니요
            </button>
          </span>
        )}
      </div>
      {runError && <p className="error-text">{runError}</p>}
      {runsLoading && runs.length === 0 && <p>불러오는 중...</p>}
      {runsError && <p className="error-text">{runsError}</p>}
      {!runsLoading && !runsError && runs.length === 0 && <p>아직 산정한 적이 없습니다</p>}
      {runs.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="tier-runs-table">
              <thead>
                <tr>
                  <th>기간</th>
                  <th>구분</th>
                  <th>시작</th>
                  <th>끝</th>
                  <th className="amount-cell">고객</th>
                  <th className="amount-cell">변경</th>
                  <th>등급별</th>
                  <th>쿠폰 발급 · 건너뜀</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periodLabel}</td>
                    <td>{RUN_REASON_LABELS[r.reason] ?? r.reason}</td>
                    <td>{kst(r.startedAt)}</td>
                    <td>{kst(r.finishedAt)}</td>
                    <td className="amount-cell">{num(r.customers)}</td>
                    <td className="amount-cell">{num(r.changed)}</td>
                    <td>{countsText(r, tiers ?? [])}</td>
                    <td>
                      {num(r.couponsIssued)} · {num(r.couponsSkipped)}
                    </td>
                    <td>
                      <span className={runStatusClass(r.status)} title={r.message ?? undefined}>
                        {RUN_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      {r.status === 'FAILED' && r.message && <div className="error-text tier-run-message">{r.message}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={runsPage} totalPages={runsTotalPages} onChange={setRunsPage} />
        </>
      )}
      <p className="form-hint">시각은 한국 시간입니다. 쿠폰 건너뜀은 비활성·수량 소진 등으로 발급하지 못한 수입니다.</p>
    </div>
  )
}
