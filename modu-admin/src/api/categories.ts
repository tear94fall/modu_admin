import { api } from './client'

/** commerce-service 카테고리 트리 한 노드. productCount 는 어드민 응답에만 있다(직접 속한 상품 수). */
export interface Category {
  id: number
  name: string
  sortOrder: number
  productCount: number | null
  /** 이모지 한 개. 없으면 앱이 이름 첫 글자를 보인다. */
  icon?: string | null
  /** 아이콘 타일 바탕색(#RRGGBB). 없으면 기본색. */
  color?: string | null
  children: Category[]
}

/** icon·color 는 빈 값이면 null 로 보내 지운다. */
export interface CategoryInput {
  name: string
  parentId: number | null
  sortOrder: number
  icon?: string | null
  color?: string | null
}

export interface CategoryNode {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
  icon?: string | null
  color?: string | null
}

/** 아이콘 타일 기본 바탕색(색을 안 골랐을 때). */
export const DEFAULT_CATEGORY_COLOR = '#F3F4F6'

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/** 요청 본문. icon·color 는 다듬고, 비었으면 null. */
export function categoryBody(input: CategoryInput) {
  return {
    name: input.name,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    icon: blankToNull(input.icon),
    color: blankToNull(input.color)?.toUpperCase() ?? null,
  }
}

const BASE = '/commerce-service/api-admin/v1/categories'

export const getCategories = () => api<Category[]>(BASE)

export const createCategory = (input: CategoryInput) => api<CategoryNode>(BASE, { method: 'POST', body: JSON.stringify(categoryBody(input)) })

export const updateCategory = (id: number, input: CategoryInput) =>
  api<CategoryNode>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(categoryBody(input)) })

export const deleteCategory = (id: number) => api<void>(`${BASE}/${id}`, { method: 'DELETE' })

/** 상품 폼·필터의 <select> 에 넣을 평면 목록. 하위는 "상위 > 하위" 로 보인다. */
export function flattenCategories(tree: Category[]): { id: number; label: string; parentId: number | null }[] {
  return tree.flatMap((root) => [
    { id: root.id, label: root.name, parentId: null },
    ...root.children.map((child) => ({ id: child.id, label: `${root.name} > ${child.name}`, parentId: root.id })),
  ])
}
