/** 상품 폼의 옵션 편집 상태. 서버로 보내기 전의 "입력 중" 모양이라 값이 전부 문자열이다. */
export interface GroupDraft {
  name: string
  /** 쉼표로 나눠 넣은 값들. 빈 값·중복은 [cleanGroups] 가 거른다. */
  values: string[]
}

export interface SkuDraft {
  options: Record<string, string>
  extraPrice: string
  stock: string
}

/** 빈 이름·빈 값·중복 값을 걷어낸 그룹. 이름이 비면 그룹째 뺀다. */
export function cleanGroups(groups: GroupDraft[]): GroupDraft[] {
  return groups
    .map((g) => ({ name: g.name.trim(), values: Array.from(new Set(g.values.map((v) => v.trim()).filter((v) => v !== ''))) }))
    .filter((g) => g.name !== '' && g.values.length > 0)
}

/** 그룹명=값명 을 그룹명 순으로 이은 조합 키. 서버(ProductSku.optionKeyOf)와 같은 규칙이다. */
export function optionKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('|')
}

/** 모든 조합(카테시안 곱). 그룹이 없으면 빈 조합 하나. */
export function combinations(groups: GroupDraft[]): Record<string, string>[] {
  return cleanGroups(groups).reduce<Record<string, string>[]>(
    (acc, group) => acc.flatMap((partial) => group.values.map((value) => ({ ...partial, [group.name]: value }))),
    [{}],
  )
}

/** 그룹 순서대로 값을 이은 표시 이름 "블랙 / M". 옵션이 없으면 빈 문자열. */
export function optionLabel(groups: GroupDraft[], options: Record<string, string>): string {
  return cleanGroups(groups)
    .map((g) => options[g.name])
    .filter((v) => v !== undefined)
    .join(' / ')
}

/**
 * 그룹이 바뀌면 조합 표를 다시 만든다. 같은 조합은 입력해 둔 추가금·재고를 그대로 들고 오고,
 * 새 조합은 0 으로 시작하며, 사라진 조합은 버린다.
 */
export function reconcileSkus(previous: SkuDraft[], groups: GroupDraft[]): SkuDraft[] {
  const byKey = new Map(previous.map((sku) => [optionKey(sku.options), sku]))
  return combinations(groups).map((options) => byKey.get(optionKey(options)) ?? { options, extraPrice: '0', stock: '0' })
}

/** 쉼표 구분 입력 → 값 목록. "블랙, 화이트" → ["블랙", "화이트"]. */
export function splitValues(text: string): string[] {
  return text.split(',').map((v) => v.trim())
}
