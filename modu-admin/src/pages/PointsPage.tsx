import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAGE_SIZE } from '../api/client'
import { ApiError } from '../api/client'
import {
  createRule,
  deleteRule,
  formatPoints,
  listRules,
  searchAccounts,
  updateRule,
  type PointAccount,
  type PointRule,
} from '../api/points'
import Pager from '../components/Pager'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatDateTime } from '../util/format'

type Tab = 'accounts' | 'rules'

export default function PointsPage() {
  const [tab, setTab] = useState<Tab>('accounts')
  return (
    <div>
      <h1>포인트</h1>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'accounts' ? 'btn btn--ghost tab active' : 'btn btn--ghost tab'}
          onClick={() => setTab('accounts')}
        >
          계정
        </button>
        <button
          type="button"
          className={tab === 'rules' ? 'btn btn--ghost tab active' : 'btn btn--ghost tab'}
          onClick={() => setTab('rules')}
        >
          적립 규칙
        </button>
      </div>
      {tab === 'accounts' ? <AccountsTab /> : <RulesTab />}
    </div>
  )
}

/** 포인트가 있는 사용자 목록. 이름·이메일은 point-service 가 member-service 에서 붙여 준다. 검색도 이름·이메일로 한다. */
function AccountsTab() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [accounts, setAccounts] = useState<PointAccount[]>([])
  const [pageNumber, setPageNumber] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchAccounts(searchTerm, page)
      .then((result) => {
        if (cancelled) return
        setAccounts(result.content)
        setPageNumber(result.number)
        setTotalPages(result.totalPages)
      })
      .catch(() => {
        if (!cancelled) setError('포인트 계정 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searchTerm, page])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearchTerm(keyword)
  }

  const open = (userId: string) => navigate(`/points/${encodeURIComponent(userId)}`)

  return (
    <>
      <div className="list-controls">
        <form className="search-form" onSubmit={onSearch}>
          <input type="text" placeholder="이름/이메일 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button type="submit" className="btn btn--primary">
            검색
          </button>
        </form>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && accounts.length === 0 && <p>포인트가 있는 사용자가 아직 없습니다</p>}

      {!loading && !error && accounts.length > 0 && isMobile && (
        <>
          <ul className="card-list">
            {accounts.map((a, i) => (
              <li key={a.userId}>
                <button type="button" className="card" onClick={() => open(a.userId)}>
                  <span className="card-num">{pageNumber * PAGE_SIZE + i + 1}</span>
                  <span className="card-body">
                    <span className="card-title">{a.username ?? '(이름 없음)'}</span>
                    <span className="card-line">{a.email ?? ''}</span>
                    <span className="card-line">{formatPoints(a.balance)}</span>
                    <span className="card-meta">
                      <span className="card-muted">{formatDateTime(a.updatedDate ?? a.createdDate)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!loading && !error && accounts.length > 0 && !isMobile && (
        <>
          <table className="list-table">
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="num-cell">번호</th>
                <th>이름</th>
                <th>이메일</th>
                <th>잔액</th>
                <th>마지막 변동</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a, i) => (
                <tr key={a.userId} className="clickable-row" onClick={() => open(a.userId)}>
                  <td className="num-cell">{pageNumber * PAGE_SIZE + i + 1}</td>
                  <td>{a.username ?? '(이름 없음)'}</td>
                  <td>{a.email ?? ''}</td>
                  <td>{formatPoints(a.balance)}</td>
                  <td>{formatDateTime(a.updatedDate ?? a.createdDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </>
  )
}

/**
 * 적립 규칙. PC 는 표, 폰은 카드. 상태는 줄에서 바로 켜고 끄고, 수정은 그 줄이 편집 폼으로 바뀐다.
 * 새 규칙은 "규칙 추가" 를 누를 때만 폼이 열린다.
 */
function RulesTab() {
  const isMobile = useIsMobile()
  const [rules, setRules] = useState<PointRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listRules()
      .then(setRules)
      .catch(() => setError('적립 규칙을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const replace = (saved: PointRule) => setRules((prev) => prev.map((r) => (r.code === saved.code ? saved : r)))

  const toggle = async (rule: PointRule) => {
    setRowError(null)
    try {
      const { name, points, dailyLimit, totalLimit } = rule
      replace(await updateRule(rule.code, { name, points, dailyLimit, totalLimit, enabled: !rule.enabled }))
    } catch {
      setRowError(`${rule.code} 상태를 바꾸지 못했습니다`)
    }
  }

  const remove = async (rule: PointRule) => {
    if (!window.confirm(`${rule.code} 규칙을 지울까요? 이미 쌓인 이력은 남습니다.`)) return
    setRowError(null)
    try {
      await deleteRule(rule.code)
      setRules((prev) => prev.filter((r) => r.code !== rule.code))
      setNotice(`${rule.code} 규칙을 지웠습니다`)
    } catch {
      setRowError(`${rule.code} 규칙을 지우지 못했습니다`)
    }
  }

  if (loading) return <p>불러오는 중...</p>
  if (error) return <p className="error-text">{error}</p>

  return (
    <>
      <div className="rules-header">
        <p className="form-hint">
          다른 서비스는 규칙 코드만 보내고 점수·상한은 여기서 정합니다. 하루 상한은 한국 시간 기준이고, 비워 두면 무제한입니다.
          규칙을 지워도 이미 쌓인 이력은 남습니다.
        </p>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setAdding((v) => !v)}>
          {adding ? '닫기' : '+ 규칙 추가'}
        </button>
      </div>
      {adding && (
        <NewRuleForm
          onCreated={(created) => {
            setRules((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)))
            setAdding(false)
            setNotice(`${created.code} 규칙을 추가했습니다`)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {notice && <p className="result-text">{notice}</p>}
      {rowError && <p className="error-text">{rowError}</p>}

      {isMobile ? (
        <ul className="card-list rules-list">
          {rules.map((rule) =>
            editing === rule.code ? (
              <li key={rule.code}>
                <RuleEditForm rule={rule} onSaved={(saved) => { replace(saved); setEditing(null) }} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={rule.code} className="card rule-row-card">
                <div className="card-body">
                  <span className="card-title">
                    {rule.name} <span className="rule-code">{rule.code}</span>
                  </span>
                  <span className="card-line">
                    <span className="rule-points">{formatPoints(rule.points)}</span> · {limitText(rule.dailyLimit, '하루')} · {limitText(rule.totalLimit, '전체')}
                  </span>
                  <span className="card-meta rule-actions">
                    <StatusPill rule={rule} onToggle={() => toggle(rule)} />
                    <RowActions rule={rule} onEdit={() => setEditing(rule.code)} onDelete={() => remove(rule)} />
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <table className="list-table rules-table">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>규칙</th>
              <th className="rule-points-cell">점수</th>
              <th>하루 상한</th>
              <th>전체 상한</th>
              <th>상태</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) =>
              editing === rule.code ? (
                <tr key={rule.code} className="rule-edit-row">
                  <td colSpan={6}>
                    <RuleEditForm rule={rule} onSaved={(saved) => { replace(saved); setEditing(null) }} onCancel={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={rule.code} className={rule.enabled ? undefined : 'rule-row--off'}>
                  <td>
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-code">{rule.code}</div>
                  </td>
                  <td className="rule-points-cell">
                    <span className="rule-points">{formatPoints(rule.points)}</span>
                  </td>
                  <td>{limitText(rule.dailyLimit)}</td>
                  <td>{limitText(rule.totalLimit)}</td>
                  <td>
                    <StatusPill rule={rule} onToggle={() => toggle(rule)} />
                  </td>
                  <td>
                    <div className="rule-actions">
                      <RowActions rule={rule} onEdit={() => setEditing(rule.code)} onDelete={() => remove(rule)} />
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </>
  )
}

/** "하루 1회", "전체 무제한" 처럼 읽히게. 표에서는 접두어 없이 "1회 / 무제한". */
function limitText(limit: number | null, prefix?: string) {
  const value = limit == null ? '무제한' : `${limit}회`
  return prefix ? `${prefix} ${value}` : value
}

/** 켜짐/꺼짐 알약. 누르면 바로 바뀐다(저장 버튼 없이). */
function StatusPill({ rule, onToggle }: { rule: PointRule; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={rule.enabled ? 'status-pill status-pill--on' : 'status-pill'}
      onClick={onToggle}
      aria-pressed={rule.enabled}
      aria-label={`${rule.code} ${rule.enabled ? '사용 중, 누르면 끔' : '꺼짐, 누르면 켬'}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {rule.enabled ? '사용 중' : '꺼짐'}
    </button>
  )
}

/** 출석 체크는 앱의 출석 버튼이 코드를 고정으로 쓰므로 서버가 삭제를 거부한다. 버튼을 아예 빼 둔다. */
function RowActions({ rule, onEdit, onDelete }: { rule: PointRule; onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <button type="button" className="btn btn--secondary btn--sm" onClick={onEdit}>
        수정
      </button>
      {rule.code !== 'DAILY_CHECKIN' && (
        <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
          삭제
        </button>
      )}
    </>
  )
}

/** 새 규칙 추가. 코드는 대문자로 시작하는 대문자·숫자·밑줄 2~32자(서버와 같은 규칙). */
function NewRuleForm({ onCreated, onCancel }: { onCreated: (rule: PointRule) => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [points, setPoints] = useState('')
  const [dailyLimit, setDailyLimit] = useState('')
  const [totalLimit, setTotalLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toLimit = (value: string) => (value.trim() === '' ? null : Number(value))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalized = code.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(normalized)) {
      setError('코드는 대문자로 시작하는 대문자·숫자·밑줄 2~32자입니다. 예: REVIEW_WRITE')
      return
    }
    setSaving(true)
    try {
      onCreated(
        await createRule({
          code: normalized,
          name,
          points: Number(points),
          dailyLimit: toLimit(dailyLimit),
          totalLimit: toLimit(totalLimit),
          enabled: true,
        }),
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('같은 코드의 규칙이 이미 있습니다')
      else setError('추가하지 못했습니다')
      setSaving(false)
    }
  }

  return (
    <form className="form-card rule-card rule-card--new" onSubmit={onSubmit} aria-label="새 규칙">
      <div className="form-heading">새 규칙</div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="new-rule-code">코드</label>
          <input id="new-rule-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="REVIEW_WRITE" autoFocus required />
        </div>
        <div className="form-field">
          <label htmlFor="new-rule-name">이름</label>
          <input id="new-rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="리뷰 작성" required />
        </div>
        <div className="form-field">
          <label htmlFor="new-rule-points">점수</label>
          <input id="new-rule-points" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="new-rule-daily">하루 상한(회)</label>
          <input id="new-rule-daily" type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="무제한" />
        </div>
        <div className="form-field">
          <label htmlFor="new-rule-total">전체 상한(회)</label>
          <input id="new-rule-total" type="number" min={1} value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} placeholder="무제한" />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          추가
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          취소
        </button>
        {error && <span className="error-text">{error}</span>}
      </div>
    </form>
  )
}

/** 한 규칙의 편집 폼. 표의 줄 자리에 들어간다. 사용 여부는 줄의 알약이 맡으므로 여기엔 없다. */
function RuleEditForm({ rule, onSaved, onCancel }: { rule: PointRule; onSaved: (rule: PointRule) => void; onCancel: () => void }) {
  const [name, setName] = useState(rule.name)
  const [points, setPoints] = useState(String(rule.points))
  const [dailyLimit, setDailyLimit] = useState(rule.dailyLimit == null ? '' : String(rule.dailyLimit))
  const [totalLimit, setTotalLimit] = useState(rule.totalLimit == null ? '' : String(rule.totalLimit))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toLimit = (value: string) => (value.trim() === '' ? null : Number(value))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      onSaved(
        await updateRule(rule.code, {
          name,
          points: Number(points),
          dailyLimit: toLimit(dailyLimit),
          totalLimit: toLimit(totalLimit),
          enabled: rule.enabled,
        }),
      )
    } catch {
      setError('저장하지 못했습니다')
      setSaving(false)
    }
  }

  const id = (field: string) => `rule-${rule.code}-${field}`

  return (
    <form className="form-card rule-card" onSubmit={onSubmit} aria-label={`규칙 ${rule.code}`}>
      <div className="form-heading">
        <span className="rule-code">{rule.code}</span>
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={id('name')}>이름</label>
          <input id={id('name')} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>
        <div className="form-field">
          <label htmlFor={id('points')}>점수</label>
          <input id={id('points')} type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor={id('daily')}>하루 상한(회)</label>
          <input id={id('daily')} type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="무제한" />
        </div>
        <div className="form-field">
          <label htmlFor={id('total')}>전체 상한(회)</label>
          <input id={id('total')} type="number" min={1} value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} placeholder="무제한" />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          저장
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          취소
        </button>
        {error && <span className="error-text">{error}</span>}
      </div>
    </form>
  )
}
