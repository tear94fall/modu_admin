import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'
import { apiErrorMessage, getToken } from '@modu/console-core'
import {
  getApiDoc,
  getApiDocServices,
  isRouted,
  isSection,
  makeRequestInterceptor,
  prepareSpec,
  SECTIONS,
  sectionCounts,
  type ApiDocService,
  type OpenApiSpec,
  type Section,
} from '../api/apiDocs'
import './ApiDocsPage.css'

/** 마지막으로 본 서비스. 콘솔마다 출처가 달라 다른 콘솔과 섞이지 않는다. */
export const LAST_SERVICE_KEY = 'modu-system-api-docs-service'

function readLastService(): string | null {
  try {
    return localStorage.getItem(LAST_SERVICE_KEY)
  } catch {
    return null
  }
}

function writeLastService(name: string) {
  try {
    localStorage.setItem(LAST_SERVICE_KEY, name)
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 기억만 못 한다.
  }
}

// 매 요청마다 저장된 콘솔 토큰을 읽는다(다시 로그인해도 새 토큰이 붙는다).
const requestInterceptor = makeRequestInterceptor(getToken)

/**
 * 서비스별 API 문서(Swagger UI). 게이트웨이가 각 서비스의 /v3/api-docs 를 모아 내려준다.
 * Try it out 은 이 콘솔의 nginx 를 거쳐 게이트웨이로 가므로 실제 서비스를 부른다. 어드민 API 는 콘솔 토큰이 자동으로 붙는다.
 */
export default function ApiDocsPage() {
  const [params, setParams] = useSearchParams()
  const [services, setServices] = useState<ApiDocService[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listAttempt, setListAttempt] = useState(0)
  // 응답은 어느 서비스 것인지와 함께 둔다. 다른 서비스를 고르면 이전 응답은 저절로 무시된다.
  const [loaded, setLoaded] = useState<{ name: string; attempt: number; spec: OpenApiSpec | null; error: string | null } | null>(null)
  const [docAttempt, setDocAttempt] = useState(0)

  const sectionParam = params.get('section')
  const section: Section = isSection(sectionParam) ? sectionParam : 'all'

  const selected = useMemo(() => {
    if (!services || services.length === 0) return null
    const has = (n: string | null) => n !== null && services.some((s) => s.name === n)
    const fromUrl = params.get('service')
    if (has(fromUrl)) return fromUrl
    const last = readLastService()
    if (has(last)) return last
    return services[0].name
  }, [services, params])

  useEffect(() => {
    let cancelled = false
    getApiDocServices()
      .then((s) => {
        if (cancelled) return
        setServices(s)
        setListError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setListError(apiErrorMessage(e, '서비스 목록을 불러오지 못했습니다'))
      })
    return () => {
      cancelled = true
    }
  }, [listAttempt])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    getApiDoc(selected)
      .then((spec) => {
        if (!cancelled) setLoaded({ name: selected, attempt: docAttempt, spec, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ name: selected, attempt: docAttempt, spec: null, error: apiErrorMessage(e, `${selected} 문서를 불러오지 못했습니다`) })
      })
    return () => {
      cancelled = true
    }
  }, [selected, docAttempt])

  const current = loaded?.name === selected && loaded.attempt === docAttempt ? loaded : null
  const spec = current?.spec ?? null
  const counts = useMemo(() => (spec ? sectionCounts(spec) : null), [spec])
  const shown = useMemo(() => (spec ? prepareSpec(spec, section) : null), [spec, section])

  const update = (service: string | null, next: Section) => {
    const p: Record<string, string> = {}
    if (service) p.service = service
    if (next !== 'all') p.section = next
    setParams(p)
  }

  const selectService = (name: string) => {
    writeLastService(name)
    update(name, section)
  }

  if (listError) {
    return (
      <div>
        <h1>API 문서</h1>
        <div className="api-docs-error" role="alert">
          <p className="error-text">{listError}</p>
          <button type="button" className="btn btn--secondary" onClick={() => {
              setListError(null)
              setListAttempt((n) => n + 1)
            }}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }
  if (!services) return <p>불러오는 중...</p>

  const docError = current?.error ?? null
  const internal = section === 'internal'
  const routed = isRouted(services.find((s) => s.name === selected))
  // 내부 API 는 게이트웨이가 막고, 라우트 없는 서비스는 게이트웨이로 닿지 않는다. 둘 다 실행 버튼을 없앤다.
  const canSubmit = routed && !internal

  return (
    <div className="api-docs">
      <h1>API 문서</h1>
      <p className="page-note">게이트웨이 라우트에 걸린 서비스의 API 입니다. Try it out 은 게이트웨이를 거쳐 실제 서비스를 부릅니다.</p>

      {services.length === 0 ? (
        <p>게이트웨이 라우트에 걸린 서비스가 없습니다</p>
      ) : (
        <>
          <div className="api-docs-bar">
            <select className="api-docs-service" aria-label="서비스" value={selected ?? ''} onChange={(e) => selectService(e.target.value)}>
              {services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.title || s.name}
                </option>
              ))}
            </select>
            <div className="access-chips api-docs-chips" role="radiogroup" aria-label="구역">
              {SECTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={section === s.value}
                  className={section === s.value ? 'access-chip access-chip--on' : 'access-chip'}
                  onClick={() => update(selected, s.value)}
                >
                  {s.label}
                  {counts && <span className="api-docs-count"> {counts[s.value]}</span>}
                </button>
              ))}
            </div>
          </div>

          {!routed && <p className="api-docs-note">게이트웨이 경로가 없어 여기서는 실행할 수 없어요</p>}
          {routed && internal && <p className="api-docs-note">내부 API 는 서비스끼리만 호출돼 여기서 실행할 수 없어요</p>}

          {docError && (
            <div className="api-docs-error" role="alert">
              <p className="error-text">{docError}</p>
              <button type="button" className="btn btn--secondary" onClick={() => setDocAttempt((n) => n + 1)}>
                다시 시도
              </button>
            </div>
          )}
          {!docError && !shown && <p>불러오는 중...</p>}

          {shown && counts && counts[section] === 0 && <p className="card-muted">이 구역에 해당하는 API 가 없습니다</p>}

          {shown && (
            <div className="api-docs-swagger">
              {/* 구역이 바뀌면 다시 만든다. supportedSubmitMethods 같은 설정은 처음 만들 때만 읽힌다. */}
              <SwaggerUI
                key={`${selected}:${section}`}
                spec={shown}
                docExpansion="list"
                filter
                deepLinking={false}
                displayRequestDuration
                defaultModelsExpandDepth={-1}
                supportedSubmitMethods={canSubmit ? undefined : []}
                requestInterceptor={requestInterceptor}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
