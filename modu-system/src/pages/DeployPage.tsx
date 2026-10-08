import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatUtcDateTime, useIsMobile } from '@modu/console-core'
import { getDeployServices, isFinished, listDeployments, matchesService, type Deployment, type DeployService, type DeployServicesResponse } from '../api/deploy'
import { DeployBy, DeploymentList, DeploymentStatusPill, DeployProgress, ServiceStatusPill } from '../components/DeployPanels'
import { NARROW_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { findResumable, forgetOpen } from '../util/openDeployments'

/** 서비스 표는 15초마다 다시 읽는다. */
const SERVICES_POLL_MS = 15_000
const RECENT_LIMIT = 5

const detailPath = (name: string) => `/deploy/${encodeURIComponent(name)}`

/**
 * 서비스 배포 목록. 행의 배포 버튼은 서비스 상세로 가서 태그 고르기를 바로 연다(고르기 → 확인 → 진행은 상세에서). 롤백도 상세에만 있다.
 * 새로고침 전부터 돌던 배포는 "진행 중인 배포" 카드에 되살려 끝까지 지켜본다.
 */
export default function DeployPage() {
  const isMobile = useIsMobile()
  // 표가 좁으면 핵심 칸(서비스·실행 중 태그·준비)만 두고 나머지는 상세 화면에서 본다. 글자를 줄여 끼워 맞추지 않는다.
  const narrow = useMediaQuery(NARROW_QUERY)
  const navigate = useNavigate()
  const [data, setData] = useState<DeployServicesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<Deployment[] | null>(null)
  const [keyword, setKeyword] = useState('')
  /** 되살린 진행 카드. 서비스 이름으로 묶는다(표가 15초마다 갱신돼도 흔들리지 않는다). */
  const [progress, setProgress] = useState<Record<string, Deployment>>({})

  const refresh = useCallback(async () => {
    try {
      const [services, deployments] = await Promise.all([getDeployServices(), listDeployments(undefined, RECENT_LIMIT)])
      setData(services)
      setRecent(deployments)
      setError(null)
    } catch {
      setError((prev) => prev ?? '배포 서비스에 연결하지 못했습니다(deploy-service 가 떠 있는지 확인)')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (!cancelled) void refresh()
    }
    tick()
    const timer = setInterval(tick, SERVICES_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  // 새로고침해도 배포는 계속 돈다. 진행 중인 배포(이력의 RUNNING + 이 탭에서 열어 둔 것)의 진행 카드를 되살린다.
  useEffect(() => {
    let cancelled = false
    findResumable()
      .then((list) => {
        if (cancelled || list.length === 0) return
        setProgress((prev) => {
          const next = { ...prev }
          for (const d of list) if (!next[d.service]) next[d.service] = d
          return next
        })
      })
      .catch(() => {
        // 이력을 못 읽으면 되살리지 않을 뿐이다(표의 오류 문구가 따로 뜬다).
      })
    return () => {
      cancelled = true
    }
  }, [])

  const services = useMemo(() => (data?.services ?? []).filter((s) => matchesService(s, keyword)), [data, keyword])

  const closeProgress = (service: string) => {
    forgetOpen(service)
    setProgress((prev) => {
      const next = { ...prev }
      delete next[service]
      return next
    })
  }

  const onFinished = (deployment: Deployment) => {
    forgetOpen(deployment.service)
    setProgress((prev) => (prev[deployment.service]?.id === deployment.id ? { ...prev, [deployment.service]: deployment } : prev))
    void refresh()
  }

  if (error && !data) return <p className="error-text">{error}</p>
  if (!data) return <p>불러오는 중...</p>

  /** 이 서비스의 배포가 돌고 있으면 새 배포를 막는다(상세에서도 막힌다). */
  const isRunning = (s: DeployService) => s.lastDeployment?.status === 'RUNNING' || (!!progress[s.name] && !isFinished(progress[s.name]))
  const deployButton = (s: DeployService) => (
    <button
      type="button"
      className="btn btn--primary btn--sm"
      disabled={isRunning(s)}
      title={isRunning(s) ? '배포가 진행 중이다. 끝난 뒤에 배포할 수 있다.' : '상세 화면에서 태그를 골라 배포한다'}
      onClick={() => navigate(detailPath(s.name), { state: { pick: true } })}
      aria-label={`${s.name} 배포`}
    >
      배포
    </button>
  )
  const detailLink = (s: DeployService) => (
    <Link className="btn btn--secondary btn--sm" to={detailPath(s.name)} aria-label={`${s.name} 상세`}>
      상세
    </Link>
  )

  // td 자체를 flex 로 만들면 표 셀 배치가 깨진다 — 셀 안에 블록 하나를 두고 그 안에서 두 줄(태그+상태 / 배포자·시각)로 배치한다.
  const renderLast = (s: DeployService) =>
    s.lastDeployment ? (
      <div className="deploy-last">
        <div className="deploy-last-line">
          <span>{s.lastDeployment.tag}</span>
          <DeploymentStatusPill status={s.lastDeployment.status} />
        </div>
        <div className="card-muted deploy-last-meta">
          <DeployBy by={s.lastDeployment.by} byId={s.lastDeployment.byId} /> · {formatUtcDateTime(s.lastDeployment.finishedAt) || '진행 중'}
        </div>
      </div>
    ) : (
      <span className="card-muted">없음</span>
    )

  const tagMismatch = (s: DeployService) => s.gitTag !== s.runningTag
  const readiness = (s: DeployService) => (
    <span className="deploy-ready">
      <ServiceStatusPill status={s.status} />{' '}
      <span className="card-muted deploy-num">
        {s.readyReplicas}/{s.desiredReplicas}
      </span>
    </span>
  )

  const all = data.services
  const stats = {
    ready: all.filter((s) => s.status === 'READY').length,
    progressing: all.filter((s) => s.status === 'PROGRESSING').length,
    degraded: all.filter((s) => s.status === 'DEGRADED').length,
    mismatch: all.filter(tagMismatch).length,
  }

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>서비스 배포</h1>
          <p className="page-head-sub">
            GHCR 태그를 골라 modu_infra kustomization 에 커밋하고 Argo CD 동기화 → 롤아웃까지 지켜봅니다. Argo 앱 {data.argocd.application}
          </p>
        </div>
        <div className="page-head-actions">
          <a className="btn btn--secondary" href={data.argocd.url} target="_blank" rel="noreferrer">
            Argo CD 열기
          </a>
        </div>
      </header>
      {error && <p className="error-text">{error}</p>}

      <section className="stat-grid" aria-label="서비스 요약">
        <div className="stat-card">
          <div className="stat-card-label">서비스</div>
          <div className="stat-card-value">
            {all.length}
            <span className="stat-card-unit">개</span>
          </div>
        </div>
        <div className="stat-card stat-card--good">
          <div className="stat-card-label">정상</div>
          <div className="stat-card-value">{stats.ready}</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card-label">롤아웃 진행 중</div>
          <div className="stat-card-value">{stats.progressing}</div>
        </div>
        <div className={stats.degraded > 0 ? 'stat-card stat-card--bad' : 'stat-card'}>
          <div className="stat-card-label">이상</div>
          <div className="stat-card-value">{stats.degraded}</div>
        </div>
        <div className={stats.mismatch > 0 ? 'stat-card stat-card--warn' : 'stat-card'}>
          <div className="stat-card-label">Git 태그와 다름</div>
          <div className="stat-card-value">{stats.mismatch}</div>
          <div className="stat-card-sub">실행 중 태그 ≠ kustomization</div>
        </div>
      </section>

      {Object.keys(progress).length > 0 && (
        <section className="section-card deploy-running" aria-label="진행 중인 배포">
          <div className="section-card-head">
            <div>
              <h2 className="section-card-title">진행 중인 배포</h2>
              <p className="section-card-hint">새로고침 전부터 돌던 배포를 끝까지 지켜본다</p>
            </div>
          </div>
          <div className="deploy-running-list">
            {Object.values(progress).map((d) => (
              <DeployProgress key={d.id} initial={d} onFinished={onFinished} onClose={() => closeProgress(d.service)} />
            ))}
          </div>
        </section>
      )}

      <section className="section-card deploy-services">
        <div className="section-card-head">
          <div>
            <h2 className="section-card-title">서비스</h2>
            <p className="section-card-hint">{isMobile ? '배포를 누르면 상세에서 태그를 고른다' : narrow ? '배포를 누르면 상세에서 태그를 고른다 · 롤백은 상세에서' : '배포를 누르면 상세에서 태그를 고른다 · 롤백은 상세에서 · Git 태그가 다르면 주황색'}</p>
          </div>
          <div className="section-card-actions">
            <input className="route-search section-card-search" type="search" aria-label="서비스 검색" placeholder="서비스·저장소·태그 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <span className="section-card-count">
              {services.length} / {data.services.length}
            </span>
          </div>
        </div>

        {data.services.length === 0 && <p className="card-muted">배포할 수 있는 서비스가 없습니다(deploy-service 설정 `deploy.services`)</p>}
        {data.services.length > 0 && services.length === 0 && <p className="card-muted">검색에 맞는 서비스가 없습니다</p>}

        {services.length > 0 && isMobile && (
          <ul className="card-rows">
            {services.map((s) => (
              <li key={s.name} className="deploy-card">
                <span className="card-body">
                  <Link className="card-title deploy-card-link" to={detailPath(s.name)}>
                    {s.name}
                  </Link>
                  <span className="card-line card-muted">
                    {s.repo} · {readiness(s)}
                  </span>
                  <span className="card-line">실행 중 {s.runningTag}</span>
                  <span className={tagMismatch(s) ? 'card-line deploy-tag--diff' : 'card-line'}>Git {s.gitTag}</span>
                  <span className="card-meta deploy-actions">
                    {deployButton(s)}
                    {detailLink(s)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {services.length > 0 && !isMobile && narrow && (
          <div className="card-table-wrap">
            <table className="list-table card-table deploy-table">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
                <col />
                <col style={{ width: '140px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>서비스</th>
                  <th>실행 중 태그</th>
                  <th>준비</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.name} className="clickable-row" onClick={() => navigate(detailPath(s.name))}>
                    <td>{s.name}</td>
                    <td className="deploy-nowrap" title={s.runningTag}>{s.runningTag}</td>
                    <td>{readiness(s)}</td>
                    <td className="deploy-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <span className="deploy-actions">
                        {deployButton(s)}
                        {detailLink(s)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {services.length > 0 && !isMobile && !narrow && (
          <div className="card-table-wrap">
            <table className="list-table card-table deploy-table">
              {/* 마지막 배포(태그+상태 알약 / 배포자·시각)가 제일 넓어야 한다: 나머지가 66% + 140px 이고 남는 폭(1281px 창에서 약 200px)을 가져간다. */}
              <colgroup>
                <col style={{ width: '17%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col />
                <col style={{ width: '140px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>서비스</th>
                  <th>저장소</th>
                  <th>실행 중 태그</th>
                  <th>Git 태그</th>
                  <th>준비</th>
                  <th>마지막 배포</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.name} className="clickable-row" onClick={() => navigate(detailPath(s.name))}>
                    <td>{s.name}</td>
                    <td className="deploy-nowrap" title={s.repo}>{s.repo}</td>
                    <td className="deploy-nowrap" title={s.runningTag}>{s.runningTag}</td>
                    <td className={tagMismatch(s) ? 'deploy-tag--diff' : undefined} title={tagMismatch(s) ? '실행 중인 태그와 다르다' : undefined}>
                      {s.gitTag}
                    </td>
                    <td>{readiness(s)}</td>
                    <td>{renderLast(s)}</td>
                    <td className="deploy-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <span className="deploy-actions">
                        {deployButton(s)}
                        {detailLink(s)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-card deploy-recent">
        <div className="section-card-head">
          <div>
            <h2 className="section-card-title">최근 배포 {RECENT_LIMIT}건</h2>
            <p className="section-card-hint">행을 누르면 단계·커밋·오류가 펼쳐진다</p>
          </div>
          <Link className="section-card-link" to="/deploy/history">
            전체 이력 →
          </Link>
        </div>
        {!recent ? <p>불러오는 중...</p> : <DeploymentList deployments={recent} isMobile={isMobile} />}
      </section>
    </div>
  )
}
