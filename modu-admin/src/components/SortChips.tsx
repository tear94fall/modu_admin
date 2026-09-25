import type { SortDir } from './SortableHeader'

export interface SortOption {
  label: string
  field: string
  defaultDir: SortDir
}

interface Props {
  options: SortOption[]
  /** 지금 적용된 정렬. 'field,dir' 그대로. */
  currentSort: string
  onChange: (sort: string) => void
}

/**
 * 카드 목록 위의 정렬 버튼 줄. 표 머리글(SortableHeader)과 같은 규칙이다 —
 * 같은 기준을 다시 누르면 방향이 뒤집히고, 다른 기준은 defaultDir 로 잡는다. 화살표도 같다(오름 ▼, 내림 ▲).
 */
export default function SortChips({ options, currentSort, onChange }: Props) {
  const [activeField, activeDir] = currentSort.split(',')
  return (
    <div className="sort-chips" role="group" aria-label="정렬">
      {options.map((option) => {
        const active = activeField === option.field
        const dir: SortDir = active ? (activeDir === 'asc' ? 'asc' : 'desc') : option.defaultDir
        const nextDir: SortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : option.defaultDir
        return (
          <button
            key={option.field}
            type="button"
            className={active ? 'sort-chip active' : 'sort-chip'}
            aria-pressed={active}
            onClick={() => onChange(`${option.field},${nextDir}`)}
          >
            {option.label}
            {active && (
              <span className="sort-arrow" aria-hidden="true">
                {dir === 'asc' ? '▼' : '▲'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
