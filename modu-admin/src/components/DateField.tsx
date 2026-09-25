import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { endOfMonth, formatDisplay, pad, parseDate, todayKst, toIso, WEEKDAYS, weekdayOf, type DatePreset } from '../util/dateInput'

/**
 * 날짜 칸(KST 달력 날짜 "YYYY-MM-DD"). 브라우저 기본 date 입력 대신 쓴다 — 기본 입력은 브라우저마다 글꼴·모양이 제각각이다.
 *
 * - 직접 입력: 2026-10-01, 2026.10.01, 20261001 모두 받는다. 제대로 된 날짜가 되면 바로 onChange.
 * - 달력: 칸을 누르거나 달력 아이콘을 누르면 열린다. 주말 색, 오늘 표시, 기간(rangeStart~rangeEnd) 칠하기, 빠른 선택 칩.
 * - 값은 문자열이라 시간대 계산이 끼지 않는다.
 */
interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  /** 이 날짜보다 앞은 고를 수 없다. */
  min?: string
  placeholder?: string
  /** 달력에서 칠할 기간(시작·종료 칸이 서로 넘겨준다). */
  rangeStart?: string
  rangeEnd?: string
  /** 빠른 선택. base 는 [presetBase] 또는 오늘. */
  presets?: DatePreset[]
  presetBase?: string
  'aria-describedby'?: string
}

export default function DateField({
  id,
  value,
  onChange,
  min,
  placeholder = 'YYYY.MM.DD',
  rangeStart,
  rangeEnd,
  presets,
  presetBase,
  'aria-describedby': describedBy,
}: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [text, setText] = useState(formatDisplay(value))
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const today = todayKst()
  const [month, setMonth] = useState(() => (value || today).slice(0, 7))
  const rootRef = useRef<HTMLDivElement>(null)

  // 바깥에서 값이 바뀌면(불러오기·빠른 선택) 글자를 맞춘다. 입력 중에는 건드리지 않는다.
  const shown = editing ? text : formatDisplay(value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openCalendar = () => {
    setMonth((value || rangeStart || today).slice(0, 7))
    setOpen(true)
  }

  const choose = (iso: string) => {
    onChange(iso)
    setText(formatDisplay(iso))
    setEditing(false)
    setOpen(false)
  }

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = toIso(y, m, 1)
    const lead = weekdayOf(first)
    const days = Number(endOfMonth(first).slice(8))
    const list: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= days; d++) list.push(toIso(y, m, d))
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [month])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const t = new Date(Date.UTC(y, m - 1 + delta, 1))
    setMonth(`${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`)
  }

  const [y, m] = month.split('-').map(Number)
  const invalid = editing && text.trim() !== '' && parseDate(text) === null
  const weekday = value ? WEEKDAYS[weekdayOf(value)] : null

  return (
    <div className="date-field" ref={rootRef}>
      <div className={invalid ? 'date-input date-input--invalid' : 'date-input'}>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={shown}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onFocus={() => {
            setText(formatDisplay(value))
            setEditing(true)
            openCalendar()
          }}
          onBlur={() => setEditing(false)}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            setEditing(true)
            if (next.trim() === '') {
              onChange('')
              return
            }
            const parsed = parseDate(next)
            if (parsed) {
              onChange(parsed)
              setMonth(parsed.slice(0, 7))
            }
          }}
        />
        {weekday && !editing && <span className={`date-weekday date-weekday--${weekdayOf(value)}`}>{weekday}</span>}
        <button type="button" className="date-icon" aria-label="달력 열기" onClick={() => (open ? setOpen(false) : openCalendar())}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {invalid && <p className="form-warning">날짜는 2026.10.01 처럼 입력하세요.</p>}

      {open && (
        <div className="date-pop" role="dialog" aria-label="날짜 선택">
          <div className="date-pop-head">
            <button type="button" className="date-nav" aria-label="이전 달" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <strong>
              {y}년 {m}월
            </strong>
            <button type="button" className="date-nav" aria-label="다음 달" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>
          <div className="date-grid" role="grid">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`date-wd date-wd--${i}`}>
                {w}
              </span>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <span key={`e${i}`} />
              const disabled = !!min && iso < min
              const selected = iso === value
              const inRange = !!rangeStart && !!rangeEnd && iso > rangeStart && iso < rangeEnd
              const edge = iso === rangeStart || iso === rangeEnd
              const cls = [
                'date-day',
                `date-day--wd${weekdayOf(iso)}`,
                iso === today ? 'date-day--today' : '',
                inRange ? 'date-day--range' : '',
                edge ? 'date-day--edge' : '',
                selected ? 'date-day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={iso}
                  type="button"
                  className={cls}
                  disabled={disabled}
                  aria-label={`${Number(iso.slice(0, 4))}년 ${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8))}일`}
                  aria-pressed={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(iso)}
                >
                  {Number(iso.slice(8))}
                </button>
              )
            })}
          </div>
          <div className="date-pop-foot">
            <button type="button" className="date-chip date-chip--today" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(min && today < min ? min : today)}>
              오늘
            </button>
            {presets?.map((p) => {
              const iso = p.pick(presetBase || today)
              return (
                <button
                  key={p.label}
                  type="button"
                  className="date-chip"
                  disabled={!!min && iso < min}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(iso)}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
