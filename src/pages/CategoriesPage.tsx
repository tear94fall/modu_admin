import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { type Category, createCategory, deleteCategory, getCategories, updateCategory } from '../api/categories'
import { validationMessage } from '../api/products'

/** 카테고리는 2단계(상위 > 하위). 하위나 상품이 있는 카테고리는 서버가 삭제를 거부하고 이유를 준다. */
export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  /** 서버 호출 한 번을 감싼다. 400 이면 서버 문구, 아니면 [fallback]. */
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null)
    setBusy(true)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(validationMessage(err) ?? fallback)
    } finally {
      setBusy(false)
    }
  }

  const onCreate = (name: string, parentId: number | null, sortOrder: number) =>
    run(() => createCategory({ name, parentId, sortOrder }), '카테고리를 추가하지 못했습니다')

  const onRename = (category: Category, parentId: number | null, name: string) =>
    run(() => updateCategory(category.id, { name, parentId, sortOrder: category.sortOrder }), '이름을 바꾸지 못했습니다')

  const onDelete = (category: Category) => {
    if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?`)) return
    void run(() => deleteCategory(category.id), '삭제하지 못했습니다')
  }

  return (
    <div>
      <h1>카테고리 관리</h1>
      {loading && <p>불러오는 중...</p>}
      {loadError && <p className="error-text">{loadError}</p>}
      {!loading && !loadError && (
        <>
          <NewCategoryForm label="상위 카테고리 추가" onCreate={(name) => onCreate(name, null, tree.length)} disabled={busy} />
          {tree.length === 0 && <p>등록된 카테고리가 없습니다</p>}
          <ul className="tree-list">
            {tree.map((root) => (
              <li key={root.id} className="tree-root">
                <CategoryRow category={root} parentId={null} onRename={onRename} onDelete={onDelete} disabled={busy} />
                <ul className="tree-children">
                  {root.children.map((child) => (
                    <li key={child.id}>
                      <CategoryRow category={child} parentId={root.id} onRename={onRename} onDelete={onDelete} disabled={busy} />
                    </li>
                  ))}
                  <li>
                    <NewCategoryForm
                      label={`${root.name} 하위 추가`}
                      compact
                      onCreate={(name) => onCreate(name, root.id, root.children.length)}
                      disabled={busy}
                    />
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
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
  onCreate: (name: string) => Promise<void>
  disabled: boolean
}) {
  const [name, setName] = useState('')
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    await onCreate(trimmed)
    setName('')
  }
  return (
    <form className={compact ? 'inline-form inline-form--compact' : 'inline-form'} onSubmit={onSubmit}>
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
  onRename,
  onDelete,
  disabled,
}: {
  category: Category
  parentId: number | null
  onRename: (category: Category, parentId: number | null, name: string) => Promise<void>
  onDelete: (category: Category) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '' || trimmed === category.name) {
      setEditing(false)
      setName(category.name)
      return
    }
    await onRename(category, parentId, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <form className="tree-row inline-form" onSubmit={save}>
        <input aria-label={`${category.name} 새 이름`} value={name} maxLength={50} autoFocus onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--primary btn--sm" disabled={disabled}>
          저장
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            setEditing(false)
            setName(category.name)
          }}
        >
          취소
        </button>
      </form>
    )
  }

  return (
    <div className="tree-row">
      <span className="tree-name">{category.name}</span>
      <span className="tree-count">상품 {category.productCount ?? 0}</span>
      <span className="tree-actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)} disabled={disabled}>
          이름 변경
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(category)} disabled={disabled}>
          삭제
        </button>
      </span>
    </div>
  )
}
