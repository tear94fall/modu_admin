import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categories from '../api/categories'
import { ApiError } from '../api/client'
import * as coupons from '../api/coupons'
import * as members from '../api/members'
import * as products from '../api/products'
import CouponFormPage from './CouponFormPage'

const tree: categories.Category[] = [
  {
    id: 1,
    name: '생활',
    sortOrder: 0,
    productCount: 0,
    children: [
      { id: 5, name: '주방', sortOrder: 0, productCount: 3, children: [] },
      { id: 6, name: '욕실', sortOrder: 1, productCount: 1, children: [] },
    ],
  },
  { id: 2, name: '문구', sortOrder: 1, productCount: 4, children: [] },
]

const detail: coupons.CouponDetail = {
  id: 7,
  name: '웰컴 3천원',
  description: '첫 주문 할인',
  code: 'WELCOME',
  discountType: 'FIXED',
  discountValue: 3000,
  maxDiscount: null,
  minOrderAmount: 10000,
  scope: 'PRODUCT',
  scopeLabel: '지정 상품 2개',
  scopeIds: [11, 12],
  scopeTargets: [
    { id: 11, name: '모두 텀블러' },
    { id: 12, name: '모두 우산' },
  ],
  issueStart: '2026-10-01',
  issueEnd: '2026-10-31',
  validUntil: null,
  validDays: 7,
  totalQuantity: 100,
  issuedCount: 12,
  usedCount: 3,
  downloadable: true,
  active: true,
  createdAt: '2026-09-25 01:00:00',
}

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 }

const member = (id: number, username: string): members.Member => ({ id, userId: `user-${id}`, email: `${username}@modu.dev`, username, role: 'USER' })

const productSummary = (id: number, name: string): products.ProductSummary => ({
  id,
  name,
  description: '',
  imageUrl: null,
  price: 10000,
  listPrice: null,
  status: 'SELLING',
  totalStock: 5,
  categoryId: null,
  categoryName: null,
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/coupons" element={<p>목록 화면</p>} />
        <Route path="/coupons/new" element={<CouponFormPage />} />
        <Route path="/coupons/:id" element={<CouponFormPage />} />
      </Routes>
    </MemoryRouter>,
  )

const fillIssuePeriod = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('발급 시작일'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('발급 종료일'), { target: { value: end } })
}

describe('CouponFormPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    vi.spyOn(coupons, 'getCouponIssues').mockResolvedValue(emptyPage)
  })

  it('creates a fixed-amount coupon for all products with a code and unlimited quantity', async () => {
    const create = vi.spyOn(coupons, 'createCoupon').mockResolvedValue(detail)
    renderAt('/coupons/new')

    expect(screen.getByRole('heading', { name: '새 쿠폰' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('정액')).toBeChecked()
    expect(screen.getByLabelText('전체 상품')).toBeChecked()
    expect(screen.queryByLabelText('최대 할인 (원)')).not.toBeInTheDocument()
    expect(screen.getByText(/입력하면 앱에서 코드로 받을 수 있어요/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('쿠폰 이름'), '웰컴 3천원')
    await userEvent.type(screen.getByLabelText('할인 금액'), '3000')
    const minOrder = screen.getByLabelText('최소 주문 금액')
    await userEvent.clear(minOrder)
    await userEvent.type(minOrder, '10000')
    fillIssuePeriod('2026-10-01', '2026-10-31')
    fireEvent.change(screen.getByLabelText('사용 기한 날짜'), { target: { value: '2026-11-30' } })
    await userEvent.type(screen.getByLabelText('쿠폰 코드'), 'welcome 26')
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('WELCOME26')
    await userEvent.click(screen.getByLabelText('앱에서 받기 노출'))

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith({
      name: '웰컴 3천원',
      description: null,
      discountType: 'FIXED',
      discountValue: 3000,
      maxDiscount: null,
      minOrderAmount: 10000,
      scope: 'ALL',
      scopeIds: [],
      issueStart: '2026-10-01',
      issueEnd: '2026-10-31',
      validUntil: '2026-11-30',
      validDays: null,
      totalQuantity: null,
      code: 'WELCOME26',
      downloadable: false,
      active: true,
    })
    expect(await screen.findByText('목록 화면')).toBeInTheDocument()
  })

  it('creates a percent coupon for chosen categories, valid for N days, with a quantity', async () => {
    const create = vi.spyOn(coupons, 'createCoupon').mockResolvedValue(detail)
    renderAt('/coupons/new')

    await userEvent.type(screen.getByLabelText('쿠폰 이름'), '생활 10%')
    await userEvent.click(screen.getByLabelText('정률'))
    await userEvent.type(screen.getByLabelText('할인율'), '10')
    await userEvent.type(screen.getByLabelText('최대 할인'), '5000')

    await userEvent.click(screen.getByLabelText('카테고리'))
    const list = await screen.findByRole('list', { name: '카테고리 고르기' })
    expect(within(list).getByLabelText('생활 > 주방')).toBeInTheDocument()
    await userEvent.click(within(list).getByLabelText('생활 > 주방'))
    await userEvent.click(within(list).getByLabelText('문구'))
    await userEvent.click(within(list).getByLabelText('생활 > 주방'))
    await userEvent.click(within(list).getByLabelText('생활'))
    expect(screen.getByText('카테고리 (2)')).toBeInTheDocument()

    fillIssuePeriod('2026-10-01', '2026-10-31')
    await userEvent.click(screen.getByLabelText('받은 날부터 N일'))
    await userEvent.type(screen.getByLabelText('사용 기한 일수'), '7')
    await userEvent.type(screen.getByLabelText('총 수량'), '500')
    await userEvent.click(screen.getByLabelText('활성'))

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        discountType: 'PERCENT',
        discountValue: 10,
        maxDiscount: 5000,
        minOrderAmount: 0,
        scope: 'CATEGORY',
        scopeIds: [2, 1],
        validUntil: null,
        validDays: 7,
        totalQuantity: 500,
        code: null,
        downloadable: true,
        active: false,
      }),
    )
  })

  it('picks products for a product-scoped coupon', async () => {
    const search = vi.spyOn(products, 'searchProducts').mockResolvedValue({ ...emptyPage, content: [productSummary(11, '모두 텀블러'), productSummary(13, '모두 머그')], totalElements: 2, totalPages: 1 })
    const create = vi.spyOn(coupons, 'createCoupon').mockResolvedValue(detail)
    renderAt('/coupons/new')

    await userEvent.type(screen.getByLabelText('쿠폰 이름'), '텀블러 할인')
    await userEvent.type(screen.getByLabelText('할인 금액'), '2000')
    fillIssuePeriod('2026-10-01', '2026-10-31')
    fireEvent.change(screen.getByLabelText('사용 기한 날짜'), { target: { value: '2026-10-31' } })
    await userEvent.click(screen.getByLabelText('지정 상품'))

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('적용할 상품을 1개 이상 고르세요')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('상품 검색'), '모두')
    await userEvent.click(screen.getByRole('button', { name: '상품 찾기' }))
    expect(search).toHaveBeenCalledWith('모두', 0)
    await userEvent.click(await screen.findByRole('button', { name: '모두 텀블러 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 머그 추가' }))
    expect(screen.getByRole('button', { name: '모두 텀블러 추가' })).toBeDisabled()
    await userEvent.click(within(screen.getByRole('list', { name: '지정 상품 목록' })).getByRole('button', { name: '모두 텀블러 빼기' }))

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ scope: 'PRODUCT', scopeIds: [13] }))
  })

  it('validates on the client before calling the server', async () => {
    const create = vi.spyOn(coupons, 'createCoupon').mockResolvedValue(detail)
    renderAt('/coupons/new')
    const submit = () => userEvent.click(screen.getByRole('button', { name: '등록' }))

    await submit()
    expect(screen.getByText('쿠폰 이름을 입력하세요')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('쿠폰 이름'), '쿠폰')
    await submit()
    expect(screen.getByText('할인 값을 1 이상의 정수로 입력하세요')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('정률'))
    await userEvent.type(screen.getByLabelText('할인율'), '95')
    await submit()
    expect(screen.getByText('할인율은 1~90% 사이여야 합니다')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('할인율'))
    await userEvent.type(screen.getByLabelText('할인율'), '20')

    await userEvent.click(screen.getByLabelText('카테고리'))
    await submit()
    expect(screen.getByText('적용할 카테고리를 1개 이상 고르세요')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('전체 상품'))

    await submit()
    expect(screen.getByText('발급 시작일과 종료일을 입력하세요')).toBeInTheDocument()
    fillIssuePeriod('2026-10-10', '2026-10-01')
    await submit()
    expect(screen.getByText('발급 종료일은 시작일보다 빠를 수 없습니다')).toBeInTheDocument()
    fillIssuePeriod('2026-10-01', '2026-10-10')

    await submit()
    expect(screen.getByText('사용 기한을 입력하세요')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('받은 날부터 N일'))
    await submit()
    expect(screen.getByText('사용 기한 일수는 1 이상의 정수여야 합니다')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('사용 기한 일수'), '3')

    await userEvent.type(screen.getByLabelText('총 수량'), '0')
    await submit()
    expect(screen.getByText('총 수량은 1 이상의 정수여야 합니다 (비우면 무제한)')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('총 수량'))

    await userEvent.type(screen.getByLabelText('쿠폰 코드'), 'ab-1')
    await submit()
    expect(screen.getByText('쿠폰 코드는 영문 대문자·숫자 4~20자입니다')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it("shows the server's message on 400", async () => {
    vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
    vi.spyOn(coupons, 'updateCoupon').mockRejectedValue(new ApiError(400, JSON.stringify({ message: '이미 사용 중인 쿠폰 코드입니다' })))
    renderAt('/coupons/7')

    expect(await screen.findByLabelText('쿠폰 이름')).toHaveValue('웰컴 3천원')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('이미 사용 중인 쿠폰 코드입니다')).toBeInTheDocument()
  })

  it('loads a coupon for editing and saves in place', async () => {
    vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
    const update = vi.spyOn(coupons, 'updateCoupon').mockResolvedValue({ ...detail, name: '웰컴 쿠폰' })
    renderAt('/coupons/7')

    const name = await screen.findByLabelText('쿠폰 이름')
    expect(screen.getByRole('heading', { name: /쿠폰 수정/ })).toBeInTheDocument()
    expect(screen.getByText('발급 12 / 100장 · 사용 3')).toBeInTheDocument()
    expect(screen.getByLabelText('설명')).toHaveValue('첫 주문 할인')
    expect(screen.getByLabelText('할인 금액')).toHaveValue(3000)
    expect(screen.getByLabelText('지정 상품')).toBeChecked()
    expect(within(screen.getByRole('list', { name: '지정 상품 목록' })).getByText('모두 우산')).toBeInTheDocument()
    expect(screen.getByLabelText('받은 날부터 N일')).toBeChecked()
    expect(screen.getByLabelText('사용 기한 일수')).toHaveValue(7)
    expect(screen.getByLabelText('총 수량')).toHaveValue(100)
    expect(screen.getByLabelText('쿠폰 코드')).toHaveValue('WELCOME')
    expect(screen.getByText(/이미 발급된 쿠폰도 있습니다/)).toBeInTheDocument()

    await userEvent.clear(name)
    await userEvent.type(name, '웰컴 쿠폰')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ name: '웰컴 쿠폰', scope: 'PRODUCT', scopeIds: [11, 12], validDays: 7, validUntil: null, totalQuantity: 100, code: 'WELCOME' }),
    )
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
  })

  it('keeps a category that is no longer in the tree', async () => {
    vi.spyOn(coupons, 'getCoupon').mockResolvedValue({ ...detail, scope: 'CATEGORY', scopeIds: [2, 99], scopeTargets: [{ id: 2, name: '문구' }, { id: 99, name: '옛 카테고리' }] })
    const update = vi.spyOn(coupons, 'updateCoupon').mockResolvedValue(detail)
    renderAt('/coupons/7')

    const list = await screen.findByRole('list', { name: '카테고리 고르기' })
    expect(await within(list).findByLabelText('문구')).toBeChecked()
    expect(within(list).getByText('(목록에 없는 카테고리)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith('7', expect.objectContaining({ scopeIds: [2, 99] }))
  })

  it('deletes only after the in-page confirmation', async () => {
    vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
    const remove = vi.spyOn(coupons, 'deleteCoupon').mockResolvedValue(undefined)
    renderAt('/coupons/7')

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    const confirm = screen.getByRole('group', { name: '삭제 확인' })
    expect(within(confirm).getByText(/'웰컴 3천원' 쿠폰을 삭제할까요\?/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(remove).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
    expect(remove).toHaveBeenCalledWith('7')
    expect(await screen.findByText('목록 화면')).toBeInTheDocument()
  })

  it('shows not found for a missing coupon', async () => {
    vi.spyOn(coupons, 'getCoupon').mockRejectedValue(new ApiError(404, ''))
    renderAt('/coupons/99')
    expect(await screen.findByText('쿠폰을 찾을 수 없습니다')).toBeInTheDocument()
  })

  describe('issues section', () => {
    it('pages through issues, filters by status, times in the display zone', async () => {
      localStorage.setItem('modu-admin.timeZone', 'Asia/Seoul')
      vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
      const issues = vi.spyOn(coupons, 'getCouponIssues').mockImplementation(async (_id, page, status) => ({
        content:
          status === 'USED'
            ? [{ id: 3, userId: 'user-c', source: 'CODE', status: 'USED', issuedAt: '2026-10-02 01:00:00', expiresOn: '2026-10-08', usedAt: '2026-10-03 02:00:00', orderId: 55, orderNo: 'O-20261003-0001' }]
            : page === 0
              ? [
                  { id: 1, userId: 'user-a', source: 'DOWNLOAD', status: 'AVAILABLE', issuedAt: '2026-10-01 15:30:00', expiresOn: '2026-10-08', usedAt: null, orderId: null, orderNo: null },
                  { id: 2, userId: 'user-b', source: 'EVENT', status: 'EXPIRED', issuedAt: '2026-10-01 01:00:00', expiresOn: '2026-10-07', usedAt: null, orderId: null, orderNo: null },
                ]
              : [{ id: 4, userId: 'user-d', source: 'ADMIN', status: 'AVAILABLE', issuedAt: '2026-09-30 23:00:00', expiresOn: '2026-10-07', usedAt: null, orderId: null, orderNo: null }],
        totalElements: status === 'USED' ? 1 : 16,
        totalPages: status === 'USED' ? 1 : 2,
        number: page,
        size: 15,
      }))
      renderAt('/coupons/7')

      const section = await screen.findByRole('region', { name: '발급 현황' })
      expect(await within(section).findByText('user-a')).toBeInTheDocument()
      expect(issues).toHaveBeenCalledWith('7', 0, null)
      expect(within(section).getByRole('heading', { name: '발급 현황 (16장)' })).toBeInTheDocument()
      const rowA = within(section).getByText('user-a').closest('tr')!
      expect(within(rowA).getByText('받기')).toBeInTheDocument()
      expect(within(rowA).getByText('사용 가능')).toBeInTheDocument()
      expect(within(rowA).getByText('2026-10-02 00:30')).toBeInTheDocument()
      expect(within(rowA).getByText('2026.10.08')).toBeInTheDocument()
      const rowB = within(section).getByText('user-b').closest('tr')!
      expect(within(rowB).getByText('이벤트')).toBeInTheDocument()
      expect(within(rowB).getByText('만료')).toBeInTheDocument()

      await userEvent.click(within(section).getByRole('button', { name: '다음' }))
      expect(await within(section).findByText('user-d')).toBeInTheDocument()
      expect(within(within(section).getByText('user-d').closest('tr')!).getByText('관리자')).toBeInTheDocument()
      expect(issues).toHaveBeenLastCalledWith('7', 1, null)

      await userEvent.click(within(section).getByRole('button', { name: '사용함' }))
      expect(await within(section).findByText('user-c')).toBeInTheDocument()
      expect(issues).toHaveBeenLastCalledWith('7', 0, 'USED')
      const rowC = within(section).getByText('user-c').closest('tr')!
      expect(within(rowC).getByText('코드')).toBeInTheDocument()
      expect(within(rowC).getByText('2026-10-03 11:00')).toBeInTheDocument()
      expect(within(rowC).getByRole('link', { name: 'O-20261003-0001' })).toHaveAttribute('href', '/orders/55')
      localStorage.removeItem('modu-admin.timeZone')
    })

    it('says so when nothing has been issued', async () => {
      vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
      renderAt('/coupons/7')
      expect(await screen.findByText('아직 발급된 쿠폰이 없습니다')).toBeInTheDocument()
    })
  })

  describe('grant section', () => {
    it('grants to picked members and reports who was skipped', async () => {
      const getCoupon = vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
      const issues = vi.spyOn(coupons, 'getCouponIssues').mockResolvedValue(emptyPage)
      const search = vi
        .spyOn(members, 'searchMembers')
        .mockResolvedValue({ content: [member(1, '소율'), member(2, '민준'), member(3, '지아')], totalElements: 3, totalPages: 1, number: 0, size: 15 })
      const grant = vi.spyOn(coupons, 'grantCoupon').mockResolvedValue({ issued: 1, skipped: [{ userId: 'user-2', reason: '이미 받은 쿠폰입니다' }] })
      renderAt('/coupons/7')

      const section = await screen.findByRole('region', { name: '회원에게 지급' })
      expect(within(section).getByRole('button', { name: '지급' })).toBeDisabled()
      await userEvent.type(within(section).getByLabelText('회원 검색'), '모두')
      await userEvent.click(within(section).getByRole('button', { name: '회원 찾기' }))
      expect(search).toHaveBeenCalledWith('모두', 0)

      await userEvent.click(await within(section).findByRole('button', { name: '소율 선택' }))
      await userEvent.click(within(section).getByRole('button', { name: '민준 선택' }))
      await userEvent.click(within(section).getByRole('button', { name: '지아 선택' }))
      expect(within(section).getByRole('button', { name: '소율 선택' })).toBeDisabled()
      const chips = within(section).getByRole('list', { name: '지급할 회원' })
      await userEvent.click(within(chips).getByRole('button', { name: '지아 빼기' }))
      expect(within(chips).queryByText('지아')).not.toBeInTheDocument()

      getCoupon.mockResolvedValue({ ...detail, issuedCount: 13 })
      const callsBefore = issues.mock.calls.length
      await userEvent.click(within(section).getByRole('button', { name: '2명에게 지급' }))
      expect(grant).toHaveBeenCalledWith('7', ['user-1', 'user-2'])
      expect(await within(section).findByText('1명 지급, 1명 제외')).toBeInTheDocument()
      expect(within(section).getByText('user-2 — 이미 받은 쿠폰입니다')).toBeInTheDocument()
      expect(within(section).queryByRole('list', { name: '지급할 회원' })).not.toBeInTheDocument()
      // 발급 수와 발급 현황을 다시 읽는다
      expect(await screen.findByText('발급 13 / 100장 · 사용 3')).toBeInTheDocument()
      expect(issues.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    it("shows the server's message when granting fails", async () => {
      vi.spyOn(coupons, 'getCoupon').mockResolvedValue(detail)
      vi.spyOn(members, 'searchMembers').mockResolvedValue({ content: [member(1, '소율')], totalElements: 1, totalPages: 1, number: 0, size: 15 })
      vi.spyOn(coupons, 'grantCoupon').mockRejectedValue(new ApiError(400, JSON.stringify({ message: '쿠폰이 모두 소진되었습니다' })))
      renderAt('/coupons/7')

      const section = await screen.findByRole('region', { name: '회원에게 지급' })
      await userEvent.click(within(section).getByRole('button', { name: '회원 찾기' }))
      await userEvent.click(await within(section).findByRole('button', { name: '소율 선택' }))
      await userEvent.click(within(section).getByRole('button', { name: '1명에게 지급' }))
      expect(await within(section).findByText('쿠폰이 모두 소진되었습니다')).toBeInTheDocument()
    })
  })
})
