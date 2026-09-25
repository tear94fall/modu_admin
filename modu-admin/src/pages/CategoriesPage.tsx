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

  const onCreate = (name: string, parentId: number | null, sortOrder: number) =>
    run(() => createCategory({ name, parentId, sortOrder }), '카테고리를 추가하지 못했습니다')

  const onSave = (category: Category, parentId: number | null, edit: CategoryEdit) =>
    run(
      () => updateCategory(category.id, { name: edit.name, parentId, sortOrder: category.sortOrder, icon: edit.icon, color: edit.color }),
      '카테고리를 저장하지 못했습니다',
    )

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
                <CategoryRow category={root} parentId={null} onSave={onSave} onDelete={onDelete} disabled={busy} />
                <ul className="tree-children">
                  {root.children.map((child) => (
                    <li key={child.id}>
                      <CategoryRow category={child} parentId={root.id} onSave={onSave} onDelete={onDelete} disabled={busy} />
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
}: {
  category: Category
  parentId: number | null
  onSave: (category: Category, parentId: number | null, edit: CategoryEdit) => Promise<boolean>
  onDelete: (category: Category) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    const save = async (edit: CategoryEdit) => {
      if (await onSave(category, parentId, edit)) setEditing(false)
    }
    return <CategoryEditor category={category} disabled={disabled} onCancel={() => setEditing(false)} onSave={save} />
  }

  return (
    <div className="tree-row">
      <CategoryIconTile icon={category.icon} color={category.color} name={category.name} />
      <span className="tree-name">{category.name}</span>
      <span className="tree-count">상품 {category.productCount ?? 0}</span>
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
