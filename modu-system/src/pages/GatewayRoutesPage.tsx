import { Fragment, useEffect, useMemo, useState } from 'react'
import { formatUtcDateTime, useIsMobile } from '@modu/console-core'
import {
  accessLabel,
  formatArgs,
  getGatewayConfig,
  otherFilters,
  routeMethods,
  routePaths,
  targetOf,
  type GatewayConfig,
  type GatewayRoute,
} from '../api/gateway'

type AccessFilter = 'ALL' | 'PUBLIC' | 'USER' | 'ADMIN'

const ACCESS_FILTERS: { value: AccessFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'PUBLIC', label: '공개' },
  { value: 'USER', label: '사용자 토큰' },
  { value: 'ADMIN', label: '관리자 토큰' },
]

function matchesAccess(r: GatewayRoute, f: AccessFilter): boolean {
  if (f === 'ALL') return true
  if (f === 'PUBLIC') return r.access.type === 'PUBLIC'
  if (f === 'ADMIN') return r.access.type === 'PROTECTED' && r.access.role === 'ROLE_ADMIN'
  return r.access.type === 'PROTECTED' && r.access.role !== 'ROLE_ADMIN'
}

function matchesKeyword(r: GatewayRoute, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return [r.id, r.uri, ...routePaths(r)].some((v) => v.toLowerCase().includes(k))
}

const accessClass = (r: GatewayRoute) =>
  r.access.type === 'PUBLIC' ? 'status-badge status-badge--done' : r.access.role === 'ROLE_ADMIN' ? 'status-badge status-badge--cancelled' : 'status-badge status-badge--shipping'

/** 게이트웨이 라우트 설정 조회. 읽기 전용이다(설정은 modu_platform gateway-service application.yml). */
export default function GatewayRoutesPage() {
  const isMobile = useIsMobile()
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [access, setAccess] = useState<AccessFilter>('ALL')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGatewayConfig()
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch(() => {
        if (!cancelled) setError('게이트웨이 설정을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const routes = useMemo(
    () => (config?.routes ?? []).filter((r) => matchesAccess(r, access) && matchesKeyword(r, keyword)),
    [config, access, keyword],
  )

  if (error) return <p className="error-text">{error}</p>
  if (!config) return <p>불러오는 중...</p>

  const counts = {
    total: config.routes.length,
    public: config.routes.filter((r) => r.access.type === 'PUBLIC').length,
    admin: config.routes.filter((r) => r.access.type === 'PROTECTED' && r.access.role === 'ROLE_ADMIN').length,
  }

  return (
    <div>
      <h1>게이트웨이 라우트</h1>
      <p className="page-note">
        게이트웨이가 지금 쓰고 있는 설정입니다(읽기 전용). 기준 시각 {formatUtcDateTime(config.generatedAt)} · 라우트 {counts.total}개(공개 {counts.public}, 관리자{' '}
        {counts.admin})
      </p>

      <section className="summary-grid">
        <div className="info-card">
          <h2>모든 요청에 붙는 필터</h2>
          <ul className="mono-list">
            {config.defaultFilters.length === 0 ? <li>없음</li> : config.defaultFilters.map((f) => <li key={formatArgs(f)}>{formatArgs(f)}</li>)}
          </ul>
        </div>
        <div className="info-card">
          <h2>CORS</h2>
          {config.cors.length === 0 ? (
            <p>설정 없음</p>
          ) : (
            config.cors.map((c) => (
              <dl key={c.pattern} className="detail-grid">
                <dt>경로</dt>
                <dd className="mono">{c.pattern}</dd>
                <dt>허용 출처</dt>
                <dd className="mono">{c.allowedOrigins.join(', ') || '-'}</dd>
                <dt>허용 메서드</dt>
                <dd className="mono">{c.allowedMethods.join(', ') || '-'}</dd>
              </dl>
            ))
          )}
        </div>
      </section>

      <div className="list-controls">
        <input className="route-search" type="search" aria-label="라우트 검색" placeholder="라우트 ID·경로·대상 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>
      <div className="access-chips" role="radiogroup" aria-label="인증 조건">
        {ACCESS_FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={access === f.value} className={access === f.value ? 'access-chip access-chip--on' : 'access-chip'} onClick={() => setAccess(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {routes.length === 0 && <p>조건에 맞는 라우트가 없습니다</p>}

      {routes.length > 0 && isMobile && (
        <ul className="card-list">
          {routes.map((r) => (
            <li key={r.id} className="card route-card">
              <span className="card-body">
                <span className="card-title mono">{r.id}</span>
                <span className="card-line">
                  <span className={accessClass(r)}>{accessLabel(r)}</span> → {targetOf(r)}
                </span>
                {routePaths(r).map((p) => (
                  <span key={p} className="card-line card-muted mono">
                    {p}
                  </span>
                ))}
                {otherFilters(r).map((f) => (
                  <span key={formatArgs(f)} className="card-line card-muted mono">
                    {formatArgs(f)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {routes.length > 0 && !isMobile && (
        <table className="list-table route-table">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>라우트 ID</th>
              <th>경로</th>
              <th>인증</th>
              <th>대상</th>
              <th>필터</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const methods = routeMethods(r)
              const filters = otherFilters(r)
              const expanded = open === r.id
              return (
                <Fragment key={r.id}>
                  <tr className="clickable-row" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                    <td className="mono">{r.id}</td>
                    <td className="mono">
                      {routePaths(r).map((p) => (
                        <div key={p}>{p}</div>
                      ))}
                      {methods.length > 0 && <div className="card-muted">{methods.join(', ')}</div>}
                    </td>
                    <td>
                      <span className={accessClass(r)}>{accessLabel(r)}</span>
                    </td>
                    <td className="mono">{targetOf(r)}</td>
                    <td>{filters.length}</td>
                  </tr>
                  {expanded && (
                    <tr className="route-detail">
                      <td colSpan={5}>
                        <dl className="detail-grid">
                          <dt>URI</dt>
                          <dd className="mono">{r.uri}</dd>
                          <dt>순서</dt>
                          <dd>{r.order}</dd>
                          <dt>조건</dt>
                          <dd className="mono">
                            {r.predicates.map((p) => (
                              <div key={formatArgs(p)}>{formatArgs(p)}</div>
                            ))}
                          </dd>
                          <dt>필터</dt>
                          <dd className="mono">
                            {r.filters.length === 0 ? '-' : r.filters.map((f) => <div key={formatArgs(f)}>{formatArgs(f)}</div>)}
                          </dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
