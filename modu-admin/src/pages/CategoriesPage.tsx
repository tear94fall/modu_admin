import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { type Category, createCategory, deleteCategory, getCategories, updateCategory } from '../api/categories'
import { validationMessage } from '../api/products'
import { CategoryIconPicker, CategoryIconTile } from '../components/CategoryIcon'

/** 편집 폼에서 고친 값. */
interface CategoryEdit {
  name: string
  icon: string
  color: string
}

/** 카테고리는 2단계(상위 > 하위). 하위나 상품이 있는 카테고리는 서버가 삭제를 거부하고 이유를 준다. */
export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

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

  /** [select] 면 새로 만든 카테고리를 바로 오른쪽에 연다(상위 추가). */
  const onCreate = (name: string, parentId: number | null, sortOrder: number, select = false) =>
    run(async () => {
      const created = await createCategory({ name, parentId, sortOrder })
      if (select && created?.id != null) setSelectedId(created.id)
    }, '카테고리를 추가하지 못했습니다')

  const onSave = (category: Category, parentId: number | null, edit: CategoryEdit) =>
    run(
      () => updateCategory(category.id, { name: edit.name, parentId, sortOrder: category.sortOrder, icon: edit.icon, color: edit.color }),
      '카테고리를 저장하지 못했습니다',
    )

  const onDelete = (category: Category) => {
    if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?`)) return
    void run(() => deleteCategory(category.id), '삭제하지 못했습니다')
  }

  const childCount = tree.reduce((n, root) => n + root.children.length, 0)
  const productTotal = (root: Category) => (root.productCount ?? 0) + root.children.reduce((m, c) => m + (c.productCount ?? 0), 0)
  const productCount = tree.reduce((n, root) => n + productTotal(root), 0)
  // 왼쪽 목록에서 고른 상위 카테고리. 지워졌거나 아직 안 골랐으면 첫 번째.
  const selected = tree.find((root) => root.id === selectedId) ?? tree[0]

  return (
    <div>
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-head-title">
            <h1>카테고리 관리</h1>
          </div>
          <p className="page-head-sub">상위 &gt; 하위 2단계입니다. 하위나 상품이 있는 카테고리는 삭제할 수 없습니다.</p>
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
                {childCount}
                <span className="stat-card-unit">개</span>
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
          {error && <p className="error-text">{error}</p>}
          <div className="category-layout">
            <nav className="category-nav" aria-label="상위 카테고리">
              <div className="category-nav-head">
                <span>상위 카테고리</span>
                <span className="category-nav-count">{tree.length}</span>
              </div>
              {tree.length === 0 && <p className="category-empty">등록된 카테고리가 없습니다</p>}
              <ul className="category-nav-list">
                {tree.map((root) => {
                  const on = selected?.id === root.id
                  return (
                    <li key={root.id}>
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
                            하위 {root.children.length} · 상품 {productTotal(root).toLocaleString('ko-KR')}
                          </span>
                        </span>
                        <span className="category-nav-chevron" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="category-nav-foot">
                <NewCategoryForm
                  label="상위 카테고리 추가"
                  compact
                  onCreate={(name) => onCreate(name, null, tree.length, true)}
                  disabled={busy}
                />
              </div>
            </nav>
            {selected && (
              <section className="category-panel" aria-label={`${selected.name} 상세`}>
                <div className="category-panel-head">
                  <CategoryRow category={selected} parentId={null} onSave={onSave} onDelete={onDelete} disabled={busy} variant="head" />
                  <div className="category-panel-stats">
                    <span className="category-chip">하위 {selected.children.length}개</span>
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
                      {selected.children.map((child) => (
                        <li key={child.id}>
                          <CategoryRow category={child} parentId={selected.id} onSave={onSave} onDelete={onDelete} disabled={busy} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="category-panel-add">
                    <NewCategoryForm
                      label={`${selected.name} 하위 추가`}
                      compact
                      onCreate={(name) => onCreate(name, selected.id, selected.children.length)}
                      disabled={busy}
                    />
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

function NewCategoryForm({
  label,
  compact,
  onCreate,
  disabled,
}: {
  label: string
  compact?: boolean
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
  return (
    <form className={compact ? 'inline-form inline-form--compact category-add' : 'inline-form category-add'} onSubmit={onSubmit}>
      <input aria-label={label} placeholder={label} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn--primary btn--sm" disabled={disabled || name.trim() === ''}>
        추가
      </button>
    </form>
  )
}

function CategoryRow({
  category,
  parentId,
  onSave,
  onDelete,
  disabled,
  variant = 'item',
}: {
  category: Category
  parentId: number | null
  onSave: (category: Category, parentId: number | null, edit: CategoryEdit) => Promise<boolean>
  onDelete: (category: Category) => void
  disabled: boolean
  /** head = 오른쪽 패널 머리(큰 아이콘·제목), item = 하위 카드 */
  variant?: 'head' | 'item'
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    const save = async (edit: CategoryEdit) => {
      if (await onSave(category, parentId, edit)) setEditing(false)
    }
    return <CategoryEditor category={category} disabled={disabled} onCancel={() => setEditing(false)} onSave={save} />
  }

  return (
    <div className={variant === 'head' ? 'tree-row category-head-row' : 'tree-row category-item'}>
      <CategoryIconTile icon={category.icon} color={category.color} name={category.name} size={variant === 'head' ? 48 : 36} />
      <span className="tree-text">
        <span className="tree-name">{category.name}</span>
        {variant === 'head' ? (
          <span className="tree-sub">상위 카테고리</span>
        ) : (
          <span className="tree-count">상품 {category.productCount ?? 0}</span>
        )}
      </span>
      <span className="tree-actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)} disabled={disabled}>
          편집
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(category)} disabled={disabled}>
          삭제
        </button>
      </span>
    </div>
  )
}

/** 이름 + 아이콘(이모지·색) 편집 폼. 미리보기 타일은 입력대로 바로 바뀐다. */
function CategoryEditor({
  category,
  disabled,
  onSave,
  onCancel,
}: {
  category: Category
  disabled: boolean
  onSave: (edit: CategoryEdit) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon ?? '')
  const [color, setColor] = useState(category.color ?? '')
  const idPrefix = `category-${category.id}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    await onSave({ name: trimmed, icon: icon.trim(), color: color.trim() })
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
        </div>
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
