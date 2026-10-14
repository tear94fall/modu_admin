import { type DragEvent, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  type Category,
  MAX_CATEGORY_DEPTH,
  createCategory,
  deleteCategory,
  descendantCount,
  flattenCategories,
  getCategories,
  productTotal,
  reorderCategories,
  subtreeHeight,
  updateCategory,
} from '../api/categories'
import { validationMessage } from '../api/products'
import { CategoryIconPicker, CategoryIconTile } from '../components/CategoryIcon'
import Select, { type SelectOption } from '../components/Select'

/** 편집 폼에서 고친 값. */
interface CategoryEdit {
  name: string
  icon: string
  color: string
  parentId: number | null
}

/** 같은 상위 아래 형제 목록 하나의 순서 바꾸기. [to] 는 옮긴 뒤 자리. */
type MoveFn = (parentId: number | null, siblings: Category[], from: number, to: number) => void

/** 끌어서 놓기 중인 항목: 어느 형제 목록(parentId)의 몇 번째인가. */
interface DragState {
  parentId: number | null
  from: number
  over: number | null
}

/** 공통으로 내려주는 동작들. */
interface RowActions {
  onSave: (category: Category, edit: CategoryEdit) => Promise<boolean>
  onDelete: (category: Category) => void
  /** 끌어서 놓기용 */
  onMove: MoveFn
  /** ↑↓ 버튼용(끝나면 포커스를 버튼에 돌려준다) */
  onOrderClick: MoveFn
  /** 편집 폼의 "상위 카테고리" 고르기 목록. */
  parentOptions: (category: Category) => SelectOption[]
  drag: DragState | null
  setDrag: (drag: DragState | null) => void
  disabled: boolean
}

/** 트리에서 [parentId] 의 하위(null 이면 최상위)를 [ids] 순서로 바꾼다. sortOrder 도 자리대로 맞춘다. */
function reorderInTree(tree: Category[], parentId: number | null, ids: number[]): Category[] {
  const arrange = (nodes: Category[]) =>
    ids.map((id, i) => ({ ...(nodes.find((n) => n.id === id) as Category), sortOrder: i })).filter((n) => n.id != null)
  if (parentId === null) return arrange(tree)
  const walk = (nodes: Category[]): Category[] =>
    nodes.map((n) => (n.id === parentId ? { ...n, children: arrange(n.children) } : { ...n, children: walk(n.children) }))
  return walk(tree)
}

/** [id] 가 속한 최상위 카테고리의 id. */
function rootIdOf(tree: Category[], id: number): number | null {
  const contains = (node: Category): boolean => node.id === id || node.children.some(contains)
  return tree.find(contains)?.id ?? null
}

/** 카테고리는 3단계(대 > 중 > 소). 하위나 상품이 있는 카테고리는 서버가 삭제를 거부하고 이유를 준다. */
export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // 순서 버튼을 누른 뒤 요청이 끝나면 같은 버튼(끝에 닿았으면 반대 버튼)에 포커스를 돌려준다.
  const refocus = useRef<{ label: string; other: string } | null>(null)

  const reload = useCallback(async () => {
    try {
      setTree(await getCategories())
      setLoadError(null)
    } catch {
      setLoadError('카테고리를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (busy || !refocus.current) return
    const { label, other } = refocus.current
    refocus.current = null
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.order-btn'))
    const target = buttons.find((b) => b.getAttribute('aria-label') === label && !b.disabled) ?? buttons.find((b) => b.getAttribute('aria-label') === other)
    target?.focus()
  }, [busy])

  /** 서버 호출 한 번을 감싼다. 400 이면 서버 문구, 아니면 [fallback]. 성공하면 true. */
  const run = async (action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setError(null)
    setBusy(true)
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(validationMessage(err) ?? fallback)
      return false
    } finally {
      setBusy(false)
    }
  }

  /** 순서는 서버가 정한다(sortOrder 를 안 보내면 형제 맨 뒤). [select] 면 새로 만든 카테고리를 바로 오른쪽에 연다(상위 추가). */
  const onCreate = (name: string, parentId: number | null, select = false) =>
    run(async () => {
      const created = await createCategory({ name, parentId })
      if (select && created?.id != null) setSelectedId(created.id)
    }, '카테고리를 추가하지 못했습니다')

  const onSave = (category: Category, edit: CategoryEdit) => {
    const flat = flattenCategories(tree)
    const currentParent = flat.find((c) => c.id === category.id)?.parentId ?? null
    const moved = edit.parentId !== currentParent
    // 다른 상위로 옮기면 그 상위의 맨 뒤에 붙인다.
    const siblings = edit.parentId === null ? tree : (findNode(tree, edit.parentId)?.children ?? [])
    const sortOrder = moved ? siblings.reduce((m, s) => Math.max(m, s.sortOrder + 1), 0) : category.sortOrder
    return run(async () => {
      await updateCategory(category.id, { name: edit.name, parentId: edit.parentId, sortOrder, icon: edit.icon, color: edit.color })
      if (moved) setSelectedId(edit.parentId === null ? category.id : rootIdOf(tree, edit.parentId))
    }, '카테고리를 저장하지 못했습니다')
  }

  const onDelete = (category: Category) => {
    if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?`)) return
    void run(() => deleteCategory(category.id), '삭제하지 못했습니다')
  }

  /** 형제 순서 바꾸기: 화면은 바로 바꾸고, 서버가 거부하면 되돌린다. */
  const onMove: MoveFn = (parentId, siblings, from, to) => {
    if (busy || from === to || to < 0 || to >= siblings.length) return
    const ids = siblings.map((s) => s.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    const before = tree
    // 아직 고른 적이 없으면(첫 번째가 열려 있음) 상위 순서를 바꿔도 지금 열린 카테고리를 그대로 둔다.
    if (selectedId == null && tree[0]) setSelectedId(tree[0].id)
    setError(null)
    setBusy(true)
    setTree(reorderInTree(tree, parentId, ids))
    void (async () => {
      try {
        const next = await reorderCategories(parentId, ids)
        if (Array.isArray(next)) setTree(next)
      } catch (err) {
        setTree(before)
        setError(validationMessage(err) ?? '순서를 바꾸지 못했습니다')
      } finally {
        setBusy(false)
      }
    })()
  }

  /** 편집 폼의 상위 후보: 자기 자신·자기 아래는 빼고, 옮기면 3단계를 넘는 곳도 뺀다. */
  const parentOptions = (category: Category): SelectOption[] => {
    const height = subtreeHeight(category)
    const own = new Set(flattenCategories([category]).map((c) => c.id))
    return [
      { value: '', label: '없음 (최상위)' },
      ...flattenCategories(tree)
        .filter((c) => !own.has(c.id) && c.depth + height <= MAX_CATEGORY_DEPTH)
        .map((c) => ({ value: String(c.id), label: c.label })),
    ]
  }

  const flat = flattenCategories(tree)
  const middleCount = flat.filter((c) => c.depth === 2).length
  const leafCount = flat.filter((c) => c.depth >= 3).length
  const productCount = tree.reduce((n, root) => n + productTotal(root), 0)
  // 왼쪽 목록에서 고른 상위 카테고리. 지워졌거나 아직 안 골랐으면 첫 번째.
  const selected = tree.find((root) => root.id === selectedId) ?? tree[0]
  const onOrderClick: MoveFn = (parentId, siblings, from, to) => {
    const name = siblings[from]?.name ?? ''
    const up = `${name} 위로`
    const down = `${name} 아래로`
    refocus.current = to < from ? { label: up, other: down } : { label: down, other: up }
    onMove(parentId, siblings, from, to)
  }
  const actions: RowActions = { onSave, onDelete, onMove, onOrderClick, parentOptions, drag, setDrag, disabled: busy }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-head-title">
            <h1>카테고리 관리</h1>
          </div>
          <p className="page-head-sub">
            대 &gt; 중 &gt; 소 3단계입니다. 같은 단계 안에서는 ↑↓ 버튼이나 손잡이를 끌어 순서를 바꿉니다. 하위나 상품이 있는 카테고리는 삭제할 수
            없습니다.
          </p>
        </div>
      </div>
      {loading && <p>불러오는 중...</p>}
      {loadError && <p className="error-text">{loadError}</p>}
      {!loading && !loadError && (
        <>
          <section className="stat-grid category-stats" aria-label="카테고리 요약">
            <div className="stat-card">
              <span className="stat-card-label">상위 카테고리</span>
              <span className="stat-card-value">
                {tree.length}
                <span className="stat-card-unit">개</span>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">하위 카테고리</span>
              <span className="stat-card-value">
                {middleCount + leafCount}
                <span className="stat-card-unit">개</span>
              </span>
              <span className="stat-card-sub">
                중분류 {middleCount} · 소분류 {leafCount}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">등록 상품</span>
              <span className="stat-card-value">
                {productCount.toLocaleString('ko-KR')}
                <span className="stat-card-unit">개</span>
              </span>
            </div>
          </section>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="category-layout">
            <nav className="category-nav" aria-label="상위 카테고리">
              <div className="category-nav-head">
                <span>상위 카테고리</span>
                <span className="category-nav-count">{tree.length}</span>
              </div>
              {tree.length === 0 && <p className="category-empty">등록된 카테고리가 없습니다</p>}
              <ul className="category-nav-list">
                {tree.map((root, index) => {
                  const on = selected?.id === root.id
                  return (
                    <Sortable key={root.id} as="li" className="category-nav-row" parentId={null} siblings={tree} index={index} actions={actions}>
                      <DragHandle parentId={null} index={index} actions={actions} />
                      <button
                        type="button"
                        className={on ? 'category-nav-item category-nav-item--on' : 'category-nav-item'}
                        aria-current={on ? 'true' : undefined}
                        onClick={() => setSelectedId(root.id)}
                      >
                        <CategoryIconTile icon={root.icon} color={root.color} name={root.name} size={32} />
                        <span className="category-nav-text">
                          <span className="category-nav-name">{root.name}</span>
                          <span className="category-nav-meta">
                            하위 {descendantCount(root)} · 상품 {productTotal(root).toLocaleString('ko-KR')}
                          </span>
                        </span>
                        <span className="category-nav-chevron" aria-hidden="true">
                          ›
                        </span>
                      </button>
                      <OrderButtons name={root.name} parentId={null} siblings={tree} index={index} actions={actions} />
                    </Sortable>
                  )
                })}
              </ul>
              <div className="category-nav-foot">
                <NewCategoryForm label="상위 카테고리 추가" compact onCreate={(name) => onCreate(name, null, true)} disabled={busy} />
              </div>
            </nav>
            {selected && (
              <section className="category-panel" aria-label={`${selected.name} 상세`}>
                <div className="category-panel-head">
                  <CategoryRow category={selected} actions={actions} variant="head" />
                  <div className="category-panel-stats">
                    <span className="category-chip">중분류 {selected.children.length}개</span>
                    <span className="category-chip">소분류 {descendantCount(selected) - selected.children.length}개</span>
                    <span className="category-chip">상품 {productTotal(selected).toLocaleString('ko-KR')}개</span>
                    {(selected.productCount ?? 0) > 0 && <span className="category-chip">상위에 직접 {selected.productCount}개</span>}
                  </div>
                </div>
                <div className="category-panel-body">
                  <h2 className="category-section-title">하위 카테고리</h2>
                  {selected.children.length === 0 ? (
                    <p className="category-empty">아직 하위 카테고리가 없습니다. 아래에서 추가하세요.</p>
                  ) : (
                    <ul className="category-children">
                      {selected.children.map((child, index) => (
                        <Sortable key={child.id} as="li" parentId={selected.id} siblings={selected.children} index={index} actions={actions}>
                          <ChildCard
                            category={child}
                            parentId={selected.id}
                            siblings={selected.children}
                            index={index}
                            actions={actions}
                            onCreate={(name) => onCreate(name, child.id)}
                          />
                        </Sortable>
                      ))}
                    </ul>
                  )}
                  <div className="category-panel-add">
                    <NewCategoryForm label={`${selected.name} 하위 추가`} compact onCreate={(name) => onCreate(name, selected.id)} disabled={busy} />
                  </div>
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function findNode(tree: Category[], id: number): Category | undefined {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return undefined
}

/**
 * 끌어서 놓기를 받는 형제 항목. 같은 형제 목록에서 끈 것만 받고(다른 단계는 그냥 위로 흘려보낸다),
 * 놓을 자리 앞/뒤에 선을 그린다. 손잡이(DragHandle)에서만 끌기 시작한다.
 */
function Sortable({
  as: Tag,
  className,
  parentId,
  siblings,
  index,
  actions,
  children,
}: {
  as: 'li' | 'div'
  className?: string
  parentId: number | null
  siblings: Category[]
  index: number
  actions: RowActions
  children: ReactNode
}) {
  const { drag, setDrag, onMove } = actions
  const mine = drag != null && drag.parentId === parentId
  const onDragOver = (e: DragEvent) => {
    if (!mine) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (drag.over !== index) setDrag({ ...drag, over: index })
  }
  const onDrop = (e: DragEvent) => {
    if (!mine) return
    e.preventDefault()
    e.stopPropagation()
    setDrag(null)
    onMove(parentId, siblings, drag.from, index)
  }
  const classes = [className, 'sortable']
  if (mine && drag.from === index) classes.push('sortable--dragging')
  if (mine && drag.over === index && drag.from !== index) classes.push(drag.from < index ? 'sortable--drop-after' : 'sortable--drop-before')
  return (
    <Tag className={classes.filter(Boolean).join(' ')} data-sortable="" onDragOver={onDragOver} onDrop={onDrop}>
      {children}
    </Tag>
  )
}

/** 끌기 손잡이. 키보드·화면낭독기 사용자는 ↑↓ 버튼을 쓰므로 숨긴다. */
function DragHandle({ parentId, index, actions }: { parentId: number | null; index: number; actions: RowActions }) {
  const { setDrag, disabled } = actions
  const onDragStart = (e: DragEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    const row = e.currentTarget.closest('[data-sortable]')
    if (row) e.dataTransfer.setDragImage(row, 16, 16)
    setDrag({ parentId, from: index, over: null })
  }
  return (
    <span
      className={disabled ? 'drag-handle drag-handle--off' : 'drag-handle'}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={() => setDrag(null)}
      title="끌어서 순서 바꾸기"
      aria-hidden="true"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" focusable="false">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="8" cy="2" r="1.5" />
        <circle cx="2" cy="8" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="2" cy="14" r="1.5" />
        <circle cx="8" cy="14" r="1.5" />
      </svg>
    </span>
  )
}

/** ↑↓ 순서 버튼. 맨 위·맨 아래에서는 해당 쪽이 꺼진다. */
function OrderButtons({
  name,
  parentId,
  siblings,
  index,
  actions,
}: {
  name: string
  parentId: number | null
  siblings: Category[]
  index: number
  actions: RowActions
}) {
  const { onOrderClick: onMove, disabled } = actions
  return (
    <span className="order-buttons">
      <button
        type="button"
        className="order-btn"
        aria-label={`${name} 위로`}
        title="위로"
        disabled={disabled || index === 0}
        onClick={() => onMove(parentId, siblings, index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="order-btn"
        aria-label={`${name} 아래로`}
        title="아래로"
        disabled={disabled || index === siblings.length - 1}
        onClick={() => onMove(parentId, siblings, index, index + 1)}
      >
        ↓
      </button>
    </span>
  )
}

function NewCategoryForm({
  label,
  compact,
  small,
  onCreate,
  disabled,
}: {
  label: string
  compact?: boolean
  /** 중분류 카드 안의 작은 추가 줄 */
  small?: boolean
  onCreate: (name: string) => Promise<boolean>
  disabled: boolean
}) {
  const [name, setName] = useState('')
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    if (await onCreate(trimmed)) setName('')
  }
  const classes = ['inline-form', compact && 'inline-form--compact', 'category-add', small && 'category-add--small'].filter(Boolean).join(' ')
  return (
    <form className={classes} onSubmit={onSubmit}>
      <input aria-label={label} placeholder={label} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn--primary btn--sm" disabled={disabled || name.trim() === ''}>
        추가
      </button>
    </form>
  )
}

/** 중분류 카드: 머리 줄 + 그 아래 소분류 줄들 + 소분류 추가. */
function ChildCard({
  category,
  parentId,
  siblings,
  index,
  actions,
  onCreate,
}: {
  category: Category
  parentId: number
  siblings: Category[]
  index: number
  actions: RowActions
  onCreate: (name: string) => Promise<boolean>
}) {
  // 이 카드는 2단계. 소분류(3단계)까지 만들 수 있다.
  const canAddChild = 2 < MAX_CATEGORY_DEPTH
  return (
    <div className="category-card">
      <CategoryRow
        category={category}
        actions={actions}
        order={{ parentId, siblings, index }}
        countLabel={`상품 ${productTotal(category).toLocaleString('ko-KR')}`}
      />
      {category.children.length > 0 && (
        <ul className="category-leaves" aria-label={`${category.name} 하위`}>
          {category.children.map((leaf, i) => (
            <Sortable key={leaf.id} as="li" parentId={category.id} siblings={category.children} index={i} actions={actions}>
              <CategoryRow
                category={leaf}
                actions={actions}
                variant="leaf"
                order={{ parentId: category.id, siblings: category.children, index: i }}
                countLabel={`상품 ${(leaf.productCount ?? 0).toLocaleString('ko-KR')}`}
              />
            </Sortable>
          ))}
        </ul>
      )}
      {canAddChild && (
        <div className="category-card-add">
          <NewCategoryForm label={`${category.name} 하위 추가`} small onCreate={onCreate} disabled={actions.disabled} />
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  category,
  actions,
  variant = 'item',
  order,
  countLabel,
}: {
  category: Category
  actions: RowActions
  /** head = 오른쪽 패널 머리(큰 아이콘·제목), item = 중분류 카드 머리, leaf = 카드 안 소분류 줄 */
  variant?: 'head' | 'item' | 'leaf'
  /** 형제 사이 순서(머리 줄은 왼쪽 목록에서 바꾸므로 없음) */
  order?: { parentId: number | null; siblings: Category[]; index: number }
  countLabel?: string
}) {
  const [editing, setEditing] = useState(false)
  const { onSave, onDelete, parentOptions, disabled } = actions

  if (editing) {
    const save = async (edit: CategoryEdit) => {
      if (await onSave(category, edit)) setEditing(false)
    }
    return (
      <CategoryEditor
        category={category}
        parentId={order?.parentId ?? null}
        parentOptions={parentOptions(category)}
        disabled={disabled}
        onCancel={() => setEditing(false)}
        onSave={save}
      />
    )
  }

  const rowClass = { head: 'tree-row category-head-row', item: 'tree-row category-item', leaf: 'tree-row category-leaf' }[variant]
  const tileSize = { head: 48, item: 36, leaf: 28 }[variant]
  return (
    <div className={rowClass}>
      {order && <DragHandle parentId={order.parentId} index={order.index} actions={actions} />}
      <CategoryIconTile icon={category.icon} color={category.color} name={category.name} size={tileSize} />
      <span className="tree-text">
        <span className="tree-name">{category.name}</span>
        {variant === 'head' ? <span className="tree-sub">상위 카테고리</span> : <span className="tree-count">{countLabel}</span>}
      </span>
      <span className="tree-actions">
        {order && <OrderButtons name={category.name} parentId={order.parentId} siblings={order.siblings} index={order.index} actions={actions} />}
        <span className="tree-edit-actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)} disabled={disabled}>
            편집
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(category)} disabled={disabled}>
            삭제
          </button>
        </span>
      </span>
    </div>
  )
}

/** 이름 + 상위 + 아이콘(이모지·색) 편집 폼. 미리보기 타일은 입력대로 바로 바뀐다. */
function CategoryEditor({
  category,
  parentId: initialParentId,
  parentOptions,
  disabled,
  onSave,
  onCancel,
}: {
  category: Category
  parentId: number | null
  parentOptions: SelectOption[]
  disabled: boolean
  onSave: (edit: CategoryEdit) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon ?? '')
  const [color, setColor] = useState(category.color ?? '')
  const [parent, setParent] = useState(initialParentId == null ? '' : String(initialParentId))
  const idPrefix = `category-${category.id}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    await onSave({ name: trimmed, icon: icon.trim(), color: color.trim(), parentId: parent === '' ? null : Number(parent) })
  }

  return (
    <form className="form-card category-editor" onSubmit={submit} aria-label={`${category.name} 편집`}>
      <div className="form-section">
        <div className="category-editor-head">
          <CategoryIconTile icon={icon} color={color} name={name || category.name} size={56} />
          <div className="form-field">
            <label htmlFor={`${idPrefix}-name`}>이름</label>
            <input
              id={`${idPrefix}-name`}
              className="input-md"
              aria-label={`${category.name} 새 이름`}
              value={name}
              maxLength={50}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <span className="form-label">상위 카테고리</span>
            <Select
              aria-label={`${category.name} 상위 카테고리`}
              value={parent}
              onChange={setParent}
              options={parentOptions}
              className="category-parent-select"
            />
          </div>
        </div>
        {parent !== (initialParentId == null ? '' : String(initialParentId)) && (
          <p className="form-hint">저장하면 하위 카테고리와 함께 옮겨지고, 옮긴 곳의 맨 뒤에 놓입니다.</p>
        )}
      </div>
      <CategoryIconPicker idPrefix={idPrefix} icon={icon} color={color} onIconChange={setIcon} onColorChange={setColor} />
      <div className="form-actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={disabled || name.trim() === ''}>
          저장
        </button>
      </div>
    </form>
  )
}
