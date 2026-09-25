import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatUtcDateTime, useIsMobile } from '@modu/console-core'
import {
  formatSize,
  getConfigFile,
  getConfigFiles,
  groupLabel,
  PROTECTION_LABELS,
  type ConfigFileSummary,
  type ConfigFileView,
  type ConfigProperty,
} from '../api/configRepo'

const protectionClass = (p: ConfigProperty) =>
  p.protection === 'ENCRYPTED' ? 'status-badge status-badge--shipping' : 'status-badge status-badge--cancelled'

function matches(p: ConfigProperty, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return p.key.toLowerCase().includes(k) || (p.protection === 'NONE' && p.value.toLowerCase().includes(k))
}

/**
 * config-repo 조회. 설정 서버가 읽는 파일을 그대로 보여 준다(읽기 전용).
 * 암호화된 값과 비밀값은 설정 서버가 가려서 내려주므로 화면에는 원래 값이 오지 않는다.
 */
export default function ConfigRepoPage() {
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [files, setFiles] = useState<ConfigFileSummary[] | null>(null)
  // 응답은 어느 파일 것인지와 함께 둔다. 다른 파일을 고르면 이전 응답은 저절로 무시된다(효과 안에서 비울 필요가 없다).
  const [loaded, setLoaded] = useState<{ path: string; view: ConfigFileView | null; error: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const selected = params.get('file') ?? files?.[0]?.path ?? null

  useEffect(() => {
    let cancelled = false
    getConfigFiles()
      .then((f) => {
        if (!cancelled) setFiles(f)
      })
      .catch(() => {
        if (!cancelled) setError('설정 파일 목록을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    getConfigFile(selected)
      .then((v) => {
        if (!cancelled) setLoaded({ path: selected, view: v, error: null })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ path: selected, view: null, error: `${selected} 파일을 불러오지 못했습니다` })
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const groups = useMemo(() => {
    const map = new Map<string, ConfigFileSummary[]>()
    for (const f of files ?? []) map.set(f.group, [...(map.get(f.group) ?? []), f])
    return [...map.entries()]
  }, [files])

  const select = (path: string) => {
    setKeyword('')
    setParams({ file: path })
  }

  if (error) return <p className="error-text">{error}</p>
  if (!files) return <p>불러오는 중...</p>

  const current = loaded?.path === selected ? loaded : null
  const view = current?.view ?? null
  const fileError = current?.error ?? null
  const summary = files.find((f) => f.path === selected)
  const all = view?.documents.flatMap((d) => d.properties) ?? []
  const hidden = all.filter((p) => p.protection !== 'NONE').length

  return (
    <div>
      <h1>Config 설정</h1>
      <p className="page-note">
        설정 서버(config-service)가 읽는 config-repo 파일입니다(읽기 전용). 암호화된 값과 비밀값은 가려서 보여 줍니다.
      </p>

      <div className="config-layout">
        {isMobile ? (
          <select className="config-file-select" aria-label="설정 파일" value={selected ?? ''} onChange={(e) => select(e.target.value)}>
            {groups.map(([group, list]) => (
              <optgroup key={group} label={groupLabel(group)}>
                {list.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <nav className="config-files" aria-label="설정 파일">
            {groups.map(([group, list]) => (
              <div key={group} className="config-group">
                <div className="config-group-title">{groupLabel(group)}</div>
                {list.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    className={f.path === selected ? 'config-file config-file--on' : 'config-file'}
                    aria-current={f.path === selected ? 'true' : undefined}
                    onClick={() => select(f.path)}
                  >
                    <span className="mono" title={f.path}>{f.name}</span>
                    <span className="config-file-meta">{formatSize(f.size)}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}

        <section className="config-content">
          {summary && (
            <div className="config-head">
              <h2 className="mono">{summary.path}</h2>
              <span className="config-file-meta">
                수정 {formatUtcDateTime(summary.modifiedAt)} · {formatSize(summary.size)}
                {view && ` · 키 ${all.length}개(가림 ${hidden})`}
              </span>
            </div>
          )}

          {fileError && <p className="error-text">{fileError}</p>}
          {!fileError && !view && selected && <p>불러오는 중...</p>}

          {view && (
            <>
              <input
                className="route-search"
                type="search"
                aria-label="키 검색"
                placeholder="키·값 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              {view.documents.map((doc) => {
                const props = doc.properties.filter((p) => matches(p, keyword))
                return (
                  <div key={doc.index} className="config-doc">
                    {view.documents.length > 1 && (
                      <div className="config-doc-title">
                        문서 {doc.index + 1}
                        {doc.activateOn ? ` · 프로필 ${doc.activateOn} 에서만` : ' · 항상'}
                      </div>
                    )}
                    {props.length === 0 ? (
                      <p className="card-muted">{keyword ? '검색에 맞는 키가 없습니다' : '키가 없습니다'}</p>
                    ) : (
                      <table className="list-table config-table">
                        <colgroup>
                          <col style={{ width: '3.5rem' }} />
                          <col style={{ width: '42%' }} />
                          <col />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>줄</th>
                            <th>키</th>
                            <th>값</th>
                          </tr>
                        </thead>
                        <tbody>
                          {props.map((p) => (
                            <tr key={p.key}>
                              <td className="card-muted config-line">{p.line ?? '-'}</td>
                              <td className="mono">{p.key}</td>
                              <td className="mono">
                                {p.protection === 'NONE' ? (
                                  p.value || <span className="card-muted">(빈 값)</span>
                                ) : (
                                  <>
                                    <span className={protectionClass(p)}>{PROTECTION_LABELS[p.protection]}</span>{' '}
                                    {p.protection === 'PARTIAL' ? p.value : <span className="card-muted">{p.value}</span>}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
