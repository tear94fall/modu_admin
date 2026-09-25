import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type Category, flattenCategories, getCategories } from '../api/categories'
import { ApiError } from '../api/client'
import {
  createProduct,
  deleteProduct,
  getProduct,
  type ProductDetail,
  type ProductInput,
  type ProductStatus,
  updateProduct,
  validationMessage,
} from '../api/products'
import { cleanGroups, type GroupDraft, optionLabel, reconcileSkus, type SkuDraft, splitValues } from '../util/options'

const MAX_IMAGES = 10
const MAX_GROUPS = 3

/** 서버 상세(옵션 값 id 기반 SKU)를 폼의 이름 기반 초안으로 바꾼다. */
function draftsFrom(p: ProductDetail): { groups: GroupDraft[]; skus: SkuDraft[] } {
  const valueName = new Map<number, [string, string]>()
  p.optionGroups.forEach((g) => g.values.forEach((v) => valueName.set(v.id, [g.name, v.name])))
  const groups = p.optionGroups.map((g) => ({ name: g.name, values: g.values.map((v) => v.name) }))
  const skus = p.skus.map((s) => ({
    options: Object.fromEntries(s.optionValueIds.map((id) => valueName.get(id) ?? ['', ''])),
    extraPrice: String(s.extraPrice),
    stock: String(s.stock),
  }))
  return { groups, skus: reconcileSkus(skus, groups) }
}

/** /products/new 는 등록, /products/:id 는 수정·삭제. 입력칸은 같다. */
export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const editing = id !== undefined
  const navigate = useNavigate()

  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<ProductStatus>('SELLING')
  const [price, setPrice] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [description, setDescription] = useState('')
  const [detail, setDetail] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [newImage, setNewImage] = useState('')
  const [groups, setGroups] = useState<GroupDraft[]>([])
  /** 그룹 값 칸의 입력 원문(쉼표 구분). 그룹과 같은 순서. */
  const [valueTexts, setValueTexts] = useState<string[]>([])
  const [skus, setSkus] = useState<SkuDraft[]>([{ options: {}, extraPrice: '0', stock: '0' }])
  /** 삭제 확인 문구에 쓴다. 입력 중인 이름이 아니라 서버에 저장된 이름이다. */
  const [savedName, setSavedName] = useState('')
  /** 미리보기를 못 그린 주소들. */
  const [failedPreviews, setFailedPreviews] = useState<string[]>([])

  const [loading, setLoading] = useState(editing)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getProduct(id)
      .then((p) => {
        if (cancelled) return
        setName(p.name)
        setCategoryId(p.categoryId)
        setStatus(p.status)
        setPrice(String(p.price))
        setListPrice(p.listPrice === null ? '' : String(p.listPrice))
        setDescription(p.description)
        setDetail(p.detail ?? '')
        setImages(p.images)
        const drafts = draftsFrom(p)
        setGroups(drafts.groups)
        setValueTexts(drafts.groups.map((g) => g.values.join(', ')))
        setSkus(drafts.skus)
        setSavedName(p.name)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError('상품을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const applyGroups = (next: GroupDraft[], texts: string[]) => {
    setGroups(next)
    setValueTexts(texts)
    setSkus((prev) => reconcileSkus(prev, next))
  }

  const addGroup = () => applyGroups([...groups, { name: '', values: [] }], [...valueTexts, ''])
  const removeGroup = (index: number) =>
    applyGroups(
      groups.filter((_, i) => i !== index),
      valueTexts.filter((_, i) => i !== index),
    )
  const setGroupName = (index: number, value: string) =>
    applyGroups(
      groups.map((g, i) => (i === index ? { ...g, name: value } : g)),
      valueTexts,
    )
  const setGroupValues = (index: number, text: string) =>
    applyGroups(
      groups.map((g, i) => (i === index ? { ...g, values: splitValues(text) } : g)),
      valueTexts.map((t, i) => (i === index ? text : t)),
    )
  const setSku = (index: number, patch: Partial<SkuDraft>) => setSkus(skus.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const addImage = () => {
    const url = newImage.trim()
    if (url === '' || images.length >= MAX_IMAGES) return
    setImages([...images, url])
    setNewImage('')
  }
  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    setImages(next)
  }

  const input = (): ProductInput => ({
    name: name.trim(),
    description: description.trim(),
    detail: detail.trim() === '' ? null : detail.trim(),
    price: Number(price),
    listPrice: listPrice.trim() === '' ? null : Number(listPrice),
    categoryId,
    status,
    images,
    optionGroups: cleanGroups(groups),
    skus: skus.map((s) => ({ options: s.options, extraPrice: Number(s.extraPrice) || 0, stock: Number(s.stock) || 0 })),
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setSubmitting(true)
    try {
      if (id) {
        const saved = await updateProduct(id, input())
        setSavedName(saved.name)
        const drafts = draftsFrom(saved)
        setSkus(drafts.skus)
        setMessage('저장했습니다')
      } else {
        await createProduct(input())
        navigate('/products')
      }
    } catch (err) {
      setError(validationMessage(err) ?? '저장하지 못했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async () => {
    if (!id || !window.confirm(`'${savedName}' 상품을 삭제할까요?`)) return
    setMessage(null)
    setError(null)
    setSubmitting(true)
    try {
      await deleteProduct(id)
      navigate('/products')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError('삭제하지 못했습니다')
      setSubmitting(false)
    }
  }

  const backLink = (
    <Link to="/products" className="back-link">
      ← 상품 목록
    </Link>
  )

  if (loading) return <p>불러오는 중...</p>
  if (notFound)
    return (
      <div>
        {backLink}
        <p>상품을 찾을 수 없습니다</p>
      </div>
    )
  if (loadError) return <p className="error-text">{loadError}</p>

  const hasOptions = cleanGroups(groups).length > 0
  const discount =
    listPrice.trim() !== '' && Number(listPrice) > Number(price) && Number(listPrice) > 0
      ? Math.floor(((Number(listPrice) - Number(price)) * 100) / Number(listPrice))
      : 0

  return (
    <div>
      {backLink}
      <h1>{editing ? '상품 수정' : '상품 등록'}</h1>
      <form className="form-card form-card--wide" onSubmit={onSubmit}>
        <div className="form-section">
          <h2 className="form-heading">기본 정보</h2>
          <div className="form-field">
            <label htmlFor="product-name">이름</label>
            <input id="product-name" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="product-category">카테고리</label>
              <select
                id="product-category"
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">미분류</option>
                {flattenCategories(categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="product-status">판매 상태</label>
              <select id="product-status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                <option value="SELLING">판매중</option>
                <option value="HIDDEN">숨김</option>
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="product-price">판매가</label>
              <input id="product-price" type="number" min={0} step={1} value={price} required onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="product-list-price">정가</label>
              <input
                id="product-list-price"
                type="number"
                min={0}
                step={1}
                placeholder="할인 없음"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
              />
              {discount > 0 && <p className="form-hint">할인율 {discount}%</p>}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="product-description">소개</label>
            <textarea id="product-description" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="product-detail">상세 설명</label>
            <textarea id="product-detail" rows={8} maxLength={20000} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">사진</h2>
          <p className="form-hint">첫 번째 사진이 대표 사진입니다. 최대 {MAX_IMAGES}장.</p>
          <ul className="image-list">
            {images.map((url, i) => (
              <li key={`${url}-${i}`} className="image-item">
                {failedPreviews.includes(url) ? (
                  <span className="product-thumb image-placeholder" />
                ) : (
                  <img src={url} alt={`사진 ${i + 1}`} className="product-thumb" onError={() => setFailedPreviews((f) => [...f, url])} />
                )}
                <span className="image-url" title={url}>
                  {i === 0 && <span className="status-badge status-badge--selling">대표</span>} {url}
                </span>
                <span className="image-actions">
                  <button type="button" className="btn btn--secondary btn--sm" aria-label={`사진 ${i + 1} 위로`} onClick={() => moveImage(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    aria-label={`사진 ${i + 1} 아래로`}
                    onClick={() => moveImage(i, 1)}
                    disabled={i === images.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" aria-label={`사진 ${i + 1} 삭제`} onClick={() => setImages(images.filter((_, j) => j !== i))}>
                    삭제
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="inline-form">
            <input
              type="url"
              aria-label="사진 URL"
              placeholder="https://"
              value={newImage}
              onChange={(e) => setNewImage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addImage()
                }
              }}
            />
            <button type="button" className="btn btn--secondary btn--sm" onClick={addImage} disabled={newImage.trim() === '' || images.length >= MAX_IMAGES}>
              사진 추가
            </button>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-heading">옵션</h2>
          <p className="form-hint">옵션 그룹(색상, 사이즈…)과 값을 쉼표로 넣으면 조합표가 만들어집니다. 최대 {MAX_GROUPS}개.</p>
          {groups.map((g, i) => (
            <div key={i} className="option-group">
              <input aria-label={`옵션 ${i + 1} 이름`} placeholder="예: 색상" value={g.name} maxLength={30} onChange={(e) => setGroupName(i, e.target.value)} />
              <input
                aria-label={`옵션 ${i + 1} 값`}
                placeholder="예: 블랙, 화이트"
                value={valueTexts[i] ?? ''}
                onChange={(e) => setGroupValues(i, e.target.value)}
              />
              <button type="button" className="btn btn--danger btn--sm" aria-label={`옵션 ${i + 1} 삭제`} onClick={() => removeGroup(i)}>
                삭제
              </button>
            </div>
          ))}
          {groups.length < MAX_GROUPS && (
            <div>
              <button type="button" className="btn btn--secondary btn--sm" onClick={addGroup}>
                옵션 그룹 추가
              </button>
            </div>
          )}

          {hasOptions ? (
            <table className="sku-table">
              <thead>
                <tr>
                  <th>조합</th>
                  <th>추가금</th>
                  <th>재고</th>
                </tr>
              </thead>
              <tbody>
                {skus.map((s, i) => {
                  const label = optionLabel(groups, s.options)
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>
                        <input aria-label={`${label} 추가금`} type="number" min={0} step={1} value={s.extraPrice} onChange={(e) => setSku(i, { extraPrice: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label={`${label} 재고`} type="number" min={0} step={1} value={s.stock} onChange={(e) => setSku(i, { stock: e.target.value })} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="form-field form-field--narrow">
              <label htmlFor="product-stock">재고</label>
              <input id="product-stock" type="number" min={0} step={1} value={skus[0]?.stock ?? '0'} onChange={(e) => setSku(0, { stock: e.target.value })} />
            </div>
          )}
        </div>

        <div className="form-actions">
          {editing && (
            <button type="button" className="btn btn--danger" onClick={onDelete} disabled={submitting}>
              삭제
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {editing ? '저장' : '등록'}
          </button>
        </div>
      </form>

      {message && <p className="result-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
