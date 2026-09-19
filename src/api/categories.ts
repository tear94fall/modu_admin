import { api } from './client'

/** commerce-service 카테고리 트리 한 노드. productCount 는 어드민 응답에만 있다(직접 속한 상품 수). */
export interface Category {
  id: number
  name: string
  sortOrder: number
  productCount: number | null
  children: Category[]
}

export interface CategoryInput {
  name: string
  parentId: number | null
  sortOrder: number
}

export interface CategoryNode {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

const BASE = '/commerce-service/api-admin/v1/categories'

export const getCategories = () => api<Category[]>(BASE)

export const createCategory = (input: CategoryInput) => api<CategoryNode>(BASE, { method: 'POST', body: JSON.stringify(input) })

export const updateCategory = (id: number, input: CategoryInput) =>
  api<CategoryNode>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteCategory = (id: number) => api<void>(`${BASE}/${id}`, { method: 'DELETE' })

/** 상품 폼·필터의 <select> 에 넣을 평면 목록. 하위는 "상위 > 하위" 로 보인다. */
export function flattenCategories(tree: Category[]): { id: number; label: string; parentId: number | null }[] {
  return tree.flatMap((root) => [
    { id: root.id, label: root.name, parentId: null },
    ...root.children.map((child) => ({ id: child.id, label: `${root.name} > ${child.name}`, parentId: root.id })),
  ])
}
