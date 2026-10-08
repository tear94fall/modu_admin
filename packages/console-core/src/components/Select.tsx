import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

/** group 을 주면 같은 group 이 이어지는 항목끼리 제목 아래 묶어 보인다(네이티브 optgroup 대신). */
export type SelectOption = { value: string; label: string; disabled?: boolean; group?: string }

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  'aria-label'?: string
  'aria-labelledby'?: string
  disabled?: boolean
  className?: string
  placeholder?: string
}

const GAP = 4
const MAX_HEIGHT = 280
const TYPEAHEAD_MS = 500

/**
 * 직접 그리는 드롭다운(네이티브 select 대신).
 * 맥 크롬은 네이티브 select 메뉴를 OS 가 그려서 메뉴 글자를 상자 글자에 맞추느라 목록이 상자 왼쪽으로 치우쳐 뜬다(CSS 로 못 옮김).
 * 여기서는 목록을 body 포털에 position: fixed 로 그려 왼쪽 끝을 상자 왼쪽 끝에 맞춘다.
 * 접근성은 WAI-ARIA "select-only combobox" 패턴 — 포커스는 늘 버튼에 있고 aria-activedescendant 로 현재 항목을 알린다.
 */
export default function Select({
  id,
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  disabled = false,
  className,
  placeholder = '',
}: Props) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<CSSProperties>({})
  const typed = useRef({ text: '', at: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const enabledFrom = useCallback(
    (start: number, step: 1 | -1) => {
      for (let i = start; i >= 0 && i < options.length; i += step) {
        if (!options[i].disabled) return i
      }
      return -1
    },
    [options],
  )

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const listHeight = Math.min(listRef.current?.scrollHeight ?? MAX_HEIGHT, MAX_HEIGHT)
    const below = window.innerHeight - rect.bottom - GAP
    const above = rect.top - GAP
    const flip = below < listHeight && above > below
    setPos({
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      ...(flip ? { bottom: `${window.innerHeight - rect.top + GAP}px` } : { top: `${rect.bottom + GAP}px` }),
      fontSize: getComputedStyle(trigger).fontSize,
    })
  }, [])

  const openList = (activeIndex?: number) => {
    if (disabled) return
    setActive(activeIndex ?? (selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabledFrom(0, 1)))
    setOpen(true)
  }

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const choose = (i: number) => {
    const option = options[i]
    if (!option || option.disabled) return
    if (option.value !== value) onChange(option.value)
    close(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || active < 0) return
    const el = document.getElementById(`${baseId}-opt-${active}`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, baseId])

  /** 글자를 치면 그 글자로 시작하는 항목으로 옮긴다. 같은 글자를 거듭 치면 다음 항목으로 돈다. */
  const typeahead = (char: string) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at > TYPEAHEAD_MS ? char : t.text + char
    t.at = now
    const query = t.text.toLocaleLowerCase()
    const repeated = query.split('').every((c) => c === query[0])
    const from = open ? active : selectedIndex
    const n = options.length
    const search = (q: string, offset: number) => {
      for (let k = 0; k < n; k++) {
        const i = (Math.max(from, 0) + offset + k) % n
        if (!options[i].disabled && options[i].label.toLocaleLowerCase().startsWith(q)) return i
      }
      return -1
    }
    let hit = search(query, query.length === 1 ? 1 : 0)
    if (hit < 0 && repeated) hit = search(query[0], 1)
    if (hit < 0) return
    if (open) setActive(hit)
    else openList(hit)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const typing = typed.current.text !== '' && Date.now() - typed.current.at <= TYPEAHEAD_MS
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        openList(e.key === 'Home' ? enabledFrom(0, 1) : enabledFrom(options.length - 1, -1))
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeahead(e.key)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const next = enabledFrom(active + 1, 1)
        if (next >= 0) setActive(next)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = enabledFrom(active < 0 ? options.length - 1 : active - 1, -1)
        if (prev >= 0) setActive(prev)
        break
      }
      case 'Home':
        e.preventDefault()
        setActive(enabledFrom(0, 1))
        break
      case 'End':
        e.preventDefault()
        setActive(enabledFrom(options.length - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        choose(active)
        break
      case ' ':
        e.preventDefault()
        if (typing) typeahead(' ')
        else choose(active)
        break
      case 'Escape':
        e.preventDefault()
        close(true)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        className={['select-trigger', className].filter(Boolean).join(' ')}
        onClick={() => {
          triggerRef.current?.focus()
          if (open) close(false)
          else openList()
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="select-trigger__value">{selected?.label ?? placeholder}</span>
        {/* 가장 긴 항목 폭으로 상자를 잡아 값이 바뀌어도 상자가 들썩이지 않게 한다 */}
        {options.map((o) => (
          // 글자는 CSS(::before attr)로만 그려 버튼의 글자·이름에 섞이지 않게
          <span key={o.value} className="select-trigger__sizer" data-label={o.label} aria-hidden="true" />
        ))}
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? id)}
            className="select-popup"
            style={pos}
            // 목록을 눌러도 버튼 포커스(=열린 상태)를 잃지 않게
            onMouseDown={(e) => e.preventDefault()}
          >
            {groupRuns(options).map((run) => {
              const items = run.indexes.map((i) => {
                const o = options[i]
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === selectedIndex}
                    aria-disabled={o.disabled || undefined}
                    className={[
                      'select-option',
                      i === active ? 'select-option--active' : '',
                      i === selectedIndex ? 'select-option--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => !o.disabled && setActive(i)}
                    onClick={() => choose(i)}
                  >
                    <span className="select-option__label">{o.label}</span>
                  </li>
                )
              })
              if (run.group === undefined) return items
              const labelId = `${baseId}-group-${run.indexes[0]}`
              return (
                <li key={labelId} role="presentation" className="select-group">
                  <div id={labelId} className="select-group__label" aria-hidden="true">
                    {run.group}
                  </div>
                  <ul role="group" aria-labelledby={labelId} className="select-group__list">
                    {items}
                  </ul>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}

/** 같은 group 이 이어지는 항목끼리 묶는다(group 없는 항목은 묶지 않음). 순서는 그대로. */
function groupRuns(options: SelectOption[]): { group?: string; indexes: number[] }[] {
  const runs: { group?: string; indexes: number[] }[] = []
  options.forEach((o, i) => {
    const last = runs[runs.length - 1]
    if (last && o.group !== undefined && last.group === o.group) last.indexes.push(i)
    else runs.push({ group: o.group, indexes: [i] })
  })
  return runs
}
