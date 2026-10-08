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
  /** 1(최상위) ~ MAX_CATEGORY_DEPTH. 예전 응답엔 없을 수 있다. */
  depth?: number
  children: Category[]
}

/** 카테고리는 3단계(대 > 중 > 소)까지. 서버도 같은 규칙으로 막는다. */
export const MAX_CATEGORY_DEPTH = 3

/** icon·color 는 빈 값이면 null 로 보내 지운다. */
export interface CategoryInput {
  name: string
  parentId: number | null
  /** 생략하면 서버가 형제 맨 뒤에 붙인다(추가할 때). */
  sortOrder?: number
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

/** 요청 본문. icon·color 는 다듬고, 비었으면 null. sortOrder 는 있을 때만 보낸다. */
export function categoryBody(input: CategoryInput) {
  return {
    name: input.name,
    parentId: input.parentId,
    ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
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

/** 형제 순서 바꾸기. [ids] 는 parentId 의 지금 하위 전부를 새 순서로. 응답은 GET 과 같은 전체 트리. */
export const reorderCategories = (parentId: number | null, ids: number[]) =>
  api<Category[]>(`${BASE}/order`, { method: 'PUT', body: JSON.stringify({ parentId, ids }) })

export interface FlatCategory {
  id: number
  /** "대 > 중 > 소" 전체 경로 */
  label: string
  parentId: number | null
  /** 1(최상위)부터 */
  depth: number
}

/** 상품 폼·필터의 드롭다운(Select)·쿠폰 대상 목록에 넣을 평면 목록. 트리 순서 그대로, 하위는 "대 > 중 > 소" 경로로 보인다. */
export function flattenCategories(tree: Category[]): FlatCategory[] {
  const walk = (nodes: Category[], parent: FlatCategory | null): FlatCategory[] =>
    nodes.flatMap((node) => {
      const item: FlatCategory = {
        id: node.id,
        label: parent ? `${parent.label} > ${node.name}` : node.name,
        parentId: parent?.id ?? null,
        depth: (parent?.depth ?? 0) + 1,
      }
      return [item, ...walk(node.children ?? [], item)]
    })
  return walk(tree, null)
}

/** [node] 와 그 아래 전부의 수(자신 제외). */
export const descendantCount = (node: Category): number => node.children.reduce((n, c) => n + 1 + descendantCount(c), 0)

/** [node] 아래 가장 깊은 단계까지의 높이. 하위가 없으면 1. */
export const subtreeHeight = (node: Category): number => 1 + node.children.reduce((m, c) => Math.max(m, subtreeHeight(c)), 0)

/** [node] 와 그 아래 전부의 상품 수(각자 직접 속한 상품의 합). */
export const productTotal = (node: Category): number => (node.productCount ?? 0) + node.children.reduce((n, c) => n + productTotal(c), 0)
