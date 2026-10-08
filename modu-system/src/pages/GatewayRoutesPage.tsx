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

/** 콘솔(직원) 토큰을 받는 라우트. 직원 권한(ROLE_ADMIN·ROLE_SYSTEM·ROLE_INTERNAL·ROLE_SUPER)은 모두 aud=modu-admin 토큰에 담긴다. */
const isConsoleRoute = (r: GatewayRoute) => r.access.type === 'PROTECTED' && (r.access.audience === 'modu-admin' || r.access.role === 'ROLE_ADMIN')

function matchesAccess(r: GatewayRoute, f: AccessFilter): boolean {
  if (f === 'ALL') return true
  if (f === 'PUBLIC') return r.access.type === 'PUBLIC'
  if (f === 'ADMIN') return isConsoleRoute(r)
  return r.access.type === 'PROTECTED' && !isConsoleRoute(r)
}

function matchesKeyword(r: GatewayRoute, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return [r.id, r.uri, ...routePaths(r)].some((v) => v.toLowerCase().includes(k))
}

const accessClass = (r: GatewayRoute) =>
  r.access.type === 'PUBLIC' ? 'status-badge status-badge--done' : isConsoleRoute(r) ? 'status-badge status-badge--cancelled' : 'status-badge status-badge--shipping'

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
    user: config.routes.filter((r) => matchesAccess(r, 'USER')).length,
    admin: config.routes.filter(isConsoleRoute).length,
  }
  const origins = new Set(config.cors.flatMap((c) => c.allowedOrigins)).size
  const countOf: Record<AccessFilter, number> = { ALL: counts.total, PUBLIC: counts.public, USER: counts.user, ADMIN: counts.admin }

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>게이트웨이 라우트</h1>
          <p className="page-head-sub">
            게이트웨이가 지금 쓰고 있는 설정입니다(읽기 전용). 기준 시각 {formatUtcDateTime(config.generatedAt)} · 라우트 {counts.total}개(공개 {counts.public}, 관리자{' '}
            {counts.admin})
          </p>
        </div>
      </header>

      <section className="stat-grid" aria-label="라우트 요약">
        <div className="stat-card">
          <div className="stat-card-label">라우트</div>
          <div className="stat-card-value">
            {counts.total}
            <span className="stat-card-unit">개</span>
          </div>
        </div>
        <div className="stat-card stat-card--good">
          <div className="stat-card-label">공개</div>
          <div className="stat-card-value">{counts.public}</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card-label">사용자 토큰</div>
          <div className="stat-card-value">{counts.user}</div>
        </div>
        <div className="stat-card stat-card--bad">
          <div className="stat-card-label">관리자 토큰</div>
          <div className="stat-card-value">{counts.admin}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">CORS 허용 출처</div>
          <div className="stat-card-value">
            {origins}
            <span className="stat-card-unit">곳</span>
          </div>
        </div>
      </section>

      <div className="route-summary">
        <section className="section-card">
          <div className="section-card-head">
            <div>
              <h2 className="section-card-title">모든 요청에 붙는 필터</h2>
              <p className="section-card-hint">라우트마다 붙는 필터보다 먼저 돈다</p>
            </div>
            <span className="section-card-count">{config.defaultFilters.length}개</span>
          </div>
          <ul className="route-filter-list">
            {config.defaultFilters.length === 0 ? <li className="card-muted">없음</li> : config.defaultFilters.map((f) => <li key={formatArgs(f)}>{formatArgs(f)}</li>)}
          </ul>
        </section>
        <section className="section-card">
          <div className="section-card-head">
            <div>
              <h2 className="section-card-title">CORS</h2>
              <p className="section-card-hint">브라우저에서 게이트웨이를 부를 수 있는 출처</p>
            </div>
          </div>
          {config.cors.length === 0 ? (
            <p className="card-muted">설정 없음</p>
          ) : (
            config.cors.map((c) => (
              <dl key={c.pattern} className="kv-grid route-cors">
                <dt>경로</dt>
                <dd>{c.pattern}</dd>
                <dt>허용 출처</dt>
                <dd className="route-origins">{c.allowedOrigins.length === 0 ? '-' : c.allowedOrigins.map((o) => <span key={o} className="route-origin">{o}</span>)}</dd>
                <dt>허용 메서드</dt>
                <dd>{c.allowedMethods.join(', ') || '-'}</dd>
              </dl>
            ))
          )}
        </section>
      </div>

      <section className="section-card route-list">
        <div className="section-card-head">
          <div>
            <h2 className="section-card-title">라우트 목록</h2>
            <p className="section-card-hint">{isMobile ? '경로·인증·대상' : '행을 누르면 URI·순서·조건·필터가 펼쳐진다'}</p>
          </div>
          <span className="section-card-count">
            {routes.length} / {counts.total}
          </span>
        </div>
        <div className="route-toolbar">
          <input className="route-search" type="search" aria-label="라우트 검색" placeholder="라우트 ID·경로·대상 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <div className="filter-chips" role="radiogroup" aria-label="인증 조건">
            {ACCESS_FILTERS.map((f) => (
              <button key={f.value} type="button" role="radio" aria-checked={access === f.value} className={access === f.value ? 'filter-chip filter-chip--on' : 'filter-chip'} onClick={() => setAccess(f.value)}>
                {f.label}
                <span className="filter-chip-count" aria-hidden="true">
                  {countOf[f.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {routes.length === 0 && <p className="card-muted route-empty">조건에 맞는 라우트가 없습니다</p>}

        {routes.length > 0 && isMobile && (
          <ul className="card-rows">
            {routes.map((r) => (
              <li key={r.id} className="route-row">
                <span className="card-title">{r.id}</span>
                <span className="route-row-line">
                  <span className={accessClass(r)}>{accessLabel(r)}</span>
                  <span className="card-muted">→ {targetOf(r)}</span>
                </span>
                {routePaths(r).map((p) => (
                  <span key={p} className="route-path">
                    {p}
                  </span>
                ))}
                {otherFilters(r).map((f) => (
                  <span key={formatArgs(f)} className="card-muted route-row-filter">
                    {formatArgs(f)}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}

        {routes.length > 0 && !isMobile && (
          <div className="card-table-wrap">
            <table className="list-table card-table route-table">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '6%' }} />
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
                      <tr className={expanded ? 'clickable-row route-row--open' : 'clickable-row'} onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                        <td className="route-id">{r.id}</td>
                        <td>
                          <div className="route-paths">
                            {routePaths(r).map((p) => (
                              <div key={p} className="route-path">
                                {p}
                              </div>
                            ))}
                            {methods.length > 0 && <div className="card-muted route-methods">{methods.join(', ')}</div>}
                          </div>
                        </td>
                        <td>
                          <span className={accessClass(r)}>{accessLabel(r)}</span>
                        </td>
                        <td className="route-target">{targetOf(r)}</td>
                        <td>
                          <span className="route-filter-count">{filters.length}</span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="route-detail">
                          <td colSpan={5}>
                            <dl className="kv-grid route-detail-grid">
                              <dt>URI</dt>
                              <dd>{r.uri}</dd>
                              <dt>순서</dt>
                              <dd>{r.order}</dd>
                              <dt>조건</dt>
                              <dd>
                                {r.predicates.map((p) => (
                                  <div key={formatArgs(p)}>{formatArgs(p)}</div>
                                ))}
                              </dd>
                              <dt>필터</dt>
                              <dd>{r.filters.length === 0 ? '-' : r.filters.map((f) => <div key={formatArgs(f)}>{formatArgs(f)}</div>)}</dd>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
