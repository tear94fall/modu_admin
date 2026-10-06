import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage, formatUtcDateTime, useIsMobile } from '@modu/console-core'
import { getDeployServices, listDeployments, matchesService, rollbackService, type Deployment, type DeployService, type DeployServicesResponse } from '../api/deploy'
import { DeployBy, DeploymentList, DeploymentStatusPill, DeployProgress, ServiceStatusPill, TagPicker } from '../components/DeployPanels'
import { NARROW_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { findResumable, forgetOpen, rememberOpen } from '../util/openDeployments'

/** 서비스 표는 15초마다 다시 읽는다. */
const SERVICES_POLL_MS = 15_000
const RECENT_LIMIT = 5

/** 서비스 아래 열리는 패널. 태그 고르기 → 배포 진행. 표가 15초마다 갱신돼도 이 상태는 서비스 이름으로만 묶여 있어 흔들리지 않는다. 여러 서비스가 동시에 열릴 수 있다. */
export type Panel = { mode: 'pick' } | { mode: 'progress'; deployment: Deployment }

const detailPath = (name: string) => `/deploy/${encodeURIComponent(name)}`

/** 서비스 배포 목록. 태그를 골라 배포하고 커밋 → Argo 동기화 → 롤아웃 진행을 지켜본다. 상세·이력은 따로 있다. */
export default function DeployPage() {
  const isMobile = useIsMobile()
  // 표가 좁으면 핵심 칸(서비스·실행 중 태그·준비)만 두고 나머지는 상세 화면에서 본다. 글자를 줄여 끼워 맞추지 않는다.
  const narrow = useMediaQuery(NARROW_QUERY)
  const navigate = useNavigate()
  const [data, setData] = useState<DeployServicesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<Deployment[] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [panels, setPanels] = useState<Record<string, Panel>>({})
  /** 롤백처럼 패널 밖에서 난 오류. 서비스별로 한 줄. */
  const [rowError, setRowError] = useState<{ service: string; message: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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

  // 새로고침해도 배포는 계속 돈다. 진행 중인 배포(이력의 RUNNING + 이 탭에서 열어 둔 것)의 패널을 되살린다.
  useEffect(() => {
    let cancelled = false
    findResumable()
      .then((list) => {
        if (cancelled || list.length === 0) return
        setPanels((prev) => {
          const next = { ...prev }
          for (const d of list) if (!next[d.service]) next[d.service] = { mode: 'progress', deployment: d }
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

  const setPanel = (service: string, panel: Panel | null) =>
    setPanels((prev) => {
      const next = { ...prev }
      if (panel) next[service] = panel
      else delete next[service]
      return next
    })

  const openPick = (service: string) => {
    setRowError(null)
    setPanel(service, { mode: 'pick' })
  }

  const openProgress = (deployment: Deployment) => {
    rememberOpen(deployment.service, deployment.id)
    setPanel(deployment.service, { mode: 'progress', deployment })
    void refresh()
  }

  const closePanel = (service: string) => {
    forgetOpen(service)
    setPanel(service, null)
  }

  const rollback = async (service: string) => {
    setRowError(null)
    setBusy(service)
    try {
      openProgress(await rollbackService(service))
    } catch (e) {
      setRowError({ service, message: apiErrorMessage(e, '롤백을 시작하지 못했습니다') })
    } finally {
      setBusy(null)
    }
  }

  const onFinished = (deployment: Deployment) => {
    forgetOpen(deployment.service)
    void refresh()
  }

  if (error && !data) return <p className="error-text">{error}</p>
  if (!data) return <p>불러오는 중...</p>

  const renderPanel = (s: DeployService) => {
    if (rowError?.service === s.name) return <p className="error-text deploy-row-error">{rowError.message}</p>
    const panel = panels[s.name]
    if (!panel) return null
    if (panel.mode === 'pick') return <TagPicker service={s} onStarted={openProgress} onClose={() => closePanel(s.name)} />
    return <DeployProgress key={panel.deployment.id} initial={panel.deployment} onFinished={onFinished} onClose={() => closePanel(s.name)} />
  }

  const deployButton = (s: DeployService) => (
    <button type="button" className="btn btn--primary btn--sm" disabled={busy === s.name} onClick={() => openPick(s.name)} aria-label={`${s.name} 배포`}>
      배포
    </button>
  )
  const rollbackButton = (s: DeployService) => (
    <button
      type="button"
      className="btn btn--secondary btn--sm"
      disabled={busy === s.name || !s.lastDeployment}
      onClick={() => void rollback(s.name)}
      aria-label={`${s.name} 롤백`}
      title={s.lastDeployment ? '마지막 성공 배포의 이전 태그로 되돌린다' : '배포 이력이 없어 되돌릴 수 없다'}
    >
      롤백
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

  return (
    <div>
      <h1>서비스 배포</h1>
      <p className="page-note">
        GHCR 태그를 골라 modu_infra kustomization 에 커밋하고 Argo CD 동기화 → 롤아웃까지 지켜봅니다. Argo 앱 {data.argocd.application} ·{' '}
        <a href={data.argocd.url} target="_blank" rel="noreferrer">
          Argo CD 열기
        </a>
      </p>
      {error && <p className="error-text">{error}</p>}

      <div className="list-controls deploy-controls">
        <input className="route-search" type="search" aria-label="서비스 검색" placeholder="서비스·저장소·태그 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <span className="card-muted deploy-count">
          {services.length} / {data.services.length}
        </span>
      </div>

      {data.services.length === 0 && <p>배포할 수 있는 서비스가 없습니다(deploy-service 설정 `deploy.services`)</p>}
      {data.services.length > 0 && services.length === 0 && <p>검색에 맞는 서비스가 없습니다</p>}

      {services.length > 0 && isMobile && (
        <ul className="card-list">
          {services.map((s) => (
            <li key={s.name} className="card deploy-card">
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
                {renderPanel(s)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {services.length > 0 && !isMobile && narrow && (
        <table className="list-table deploy-table">
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
            {services.map((s) => {
              const panelNode = renderPanel(s)
              return (
                <Fragment key={s.name}>
                  <tr className="clickable-row" onClick={() => navigate(detailPath(s.name))}>
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
                  {panelNode && (
                    <tr className="deploy-panel-row">
                      <td colSpan={4}>{panelNode}</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      {services.length > 0 && !isMobile && !narrow && (
        <table className="list-table deploy-table">
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
            {services.map((s) => {
              const panelNode = renderPanel(s)
              return (
                <Fragment key={s.name}>
                  <tr className="clickable-row" onClick={() => navigate(detailPath(s.name))}>
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
                        {rollbackButton(s)}
                      </span>
                    </td>
                  </tr>
                  {panelNode && (
                    <tr className="deploy-panel-row">
                      <td colSpan={7}>{panelNode}</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      <section className="deploy-history">
        <div className="deploy-history-head">
          <h2>최근 배포 {RECENT_LIMIT}건</h2>
          <Link to="/deploy/history">전체 이력 →</Link>
        </div>
        {!recent ? <p>불러오는 중...</p> : <DeploymentList deployments={recent} isMobile={isMobile} />}
      </section>
    </div>
  )
}
