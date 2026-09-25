import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as coupons from '../api/coupons'
import * as points from '../api/points'
import * as products from '../api/products'
import * as promotions from '../api/promotions'
import PromotionFormPage from './PromotionFormPage'

const rules: points.PointRule[] = [
  { code: 'DAILY_CHECKIN', name: '출석 체크', points: 10, dailyLimit: 1, totalLimit: null, enabled: true },
  { code: 'REVIEW', name: '리뷰 작성', points: 100, dailyLimit: null, totalLimit: null, enabled: true },
  { code: 'OLD_EVENT', name: '지난 이벤트', points: 50, dailyLimit: 1, totalLimit: null, enabled: false },
]

const productSummary = (id: number, name: string, status: products.ProductStatus = 'SELLING'): products.ProductSummary => ({
  id,
  name,
  description: '',
  imageUrl: `https://img/${id}.png`,
  price: 10000 * id,
  listPrice: null,
  status,
  totalStock: 5,
  categoryId: null,
  categoryName: null,
})

const productPage = (content: products.ProductSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const exhibition: promotions.PromotionDetail = {
  id: 3,
  type: 'EXHIBITION',
  eventKind: null,
  title: '가을 신상 기획전',
  subtitle: '최대 30%',
  description: '가을 신상품 모음',
  startDate: '2026-09-20',
  endDate: '2026-10-05',
  status: 'ONGOING',
  visible: true,
  sortOrder: 1,
  productCount: 2,
  attendanceCount: 0,
  couponCount: 0,
  bannerImageUrl: null,
  bannerColor: '#E11D48',
  pointRuleCode: null,
  rewardPoints: null,
  products: [
    { id: 1, name: '모두 텀블러', imageUrl: null, price: 24000, listPrice: 30000, status: 'SELLING' },
    { id: 2, name: '모두 우산', imageUrl: null, price: 15000, listPrice: null, status: 'HIDDEN' },
  ],
  coupons: [],
  createdAt: '2026-09-19 03:00:00',
  updatedAt: '2026-09-19 03:00:00',
}

const checkin: promotions.PromotionDetail = {
  ...exhibition,
  id: 4,
  type: 'EVENT',
  eventKind: 'ATTENDANCE',
  title: '10월 출석 체크',
  subtitle: null,
  description: null,
  status: 'UPCOMING',
  productCount: 0,
  attendanceCount: 2,
  pointRuleCode: 'DAILY_CHECKIN',
  rewardPoints: 10,
  products: [],
}

const coupon = (id: number, name: string, extra: Partial<coupons.CouponSummary> = {}): coupons.CouponSummary => ({
  id,
  name,
  code: null,
  discountType: 'FIXED',
  discountValue: 3000,
  maxDiscount: null,
  minOrderAmount: 0,
  scope: 'ALL',
  scopeLabel: '전체 상품',
  issueStart: '2026-10-01',
  issueEnd: '2026-10-31',
  validUntil: '2026-11-30',
  validDays: null,
  totalQuantity: 100,
  issuedCount: 12,
  usedCount: 3,
  downloadable: false,
  active: true,
  createdAt: '2026-09-25 01:00:00',
  ...extra,
})

const couponPage = (content: coupons.CouponSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/promotions" element={<p>목록 화면</p>} />
        <Route path="/promotions/new" element={<PromotionFormPage />} />
        <Route path="/promotions/:id" element={<PromotionFormPage />} />
      </Routes>
    </MemoryRouter>,
  )

const fillDates = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: end } })
}

describe('PromotionFormPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(points, 'listRules').mockResolvedValue(rules)
    vi.spyOn(promotions, 'getAttendances').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 })
  })

  it('creates an exhibition with searched products in the chosen order', async () => {
    const search = vi
      .spyOn(products, 'searchProducts')
      .mockResolvedValue(productPage([productSummary(1, '모두 텀블러'), productSummary(2, '모두 우산', 'HIDDEN'), productSummary(3, '모두 머그')]))
    const create = vi.spyOn(promotions, 'createPromotion').mockResolvedValue(exhibition)
    renderAt('/promotions/new')

    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('기획전')).toBeChecked()
    await userEvent.type(screen.getByLabelText('제목'), '가을 신상 기획전')
    await userEvent.type(screen.getByLabelText('부제'), '최대 30%')
    await userEvent.type(screen.getByLabelText('배너 색'), '#e11d48')
    fillDates('2026-09-20', '2026-10-05')

    // 미리보기: 이미지가 없으면 배너 색 위에 제목
    const preview = screen.getByTestId('banner-preview')
    expect(preview).toHaveStyle({ background: '#e11d48' })
    expect(within(preview).getByText('가을 신상 기획전')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('상품 검색'), '모두')
    await userEvent.click(screen.getByRole('button', { name: '상품 찾기' }))
    expect(search).toHaveBeenCalledWith('모두', 0)
    const results = await screen.findByRole('list', { name: '상품 검색 결과' })
    expect(within(results).getByText('숨김')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '모두 머그 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 텀블러 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 우산 추가' }))
    expect(screen.getByRole('button', { name: '모두 머그 추가' })).toBeDisabled()
    // 텀블러를 맨 위로, 우산은 뺀다
    await userEvent.click(screen.getByRole('button', { name: '모두 텀블러 위로' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 우산 빼기' }))
    expect(screen.getByRole('heading', { name: '상품 (2)' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith({
      type: 'EXHIBITION',
      title: '가을 신상 기획전',
      subtitle: '최대 30%',
      description: null,
      bannerImageUrl: null,
      bannerColor: '#E11D48',
      startDate: '2026-09-20',
      endDate: '2026-10-05',
      visible: true,
      sortOrder: 0,
      productIds: [1, 3],
      couponIds: [],
    })
    expect(await screen.findByText('목록 화면')).toBeInTheDocument()
  })

  it('creates an attendance event with the chosen point rule and its points', async () => {
    const create = vi.spyOn(promotions, 'createPromotion').mockResolvedValue(checkin)
    renderAt('/promotions/new')

    await userEvent.click(screen.getByLabelText('이벤트'))
    expect(screen.getByText(/출석 체크 — 기간 동안 하루 한 번/)).toBeInTheDocument()
    expect(screen.queryByLabelText('상품 검색')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('제목'), '10월 출석 체크')
    fillDates('2026-10-01', '2026-10-31')
    await userEvent.click(screen.getByLabelText('앱에 노출'))
    const order = screen.getByLabelText('순서')
    await userEvent.clear(order)
    await userEvent.type(order, '2')

    const select = screen.getByLabelText('보상 포인트 규칙')
    expect(await screen.findByRole('option', { name: '출석 체크 (DAILY_CHECKIN) · 10 P · 하루 1회' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '리뷰 작성 (REVIEW) · 100 P · 하루 무제한' })).toBeInTheDocument()

    await userEvent.selectOptions(select, 'REVIEW')
    expect(screen.getByText(/하루 한도가 없는 규칙입니다/)).toBeInTheDocument()
    await userEvent.selectOptions(select, 'OLD_EVENT')
    expect(screen.getByText(/꺼진 규칙입니다/)).toBeInTheDocument()
    await userEvent.selectOptions(select, 'DAILY_CHECKIN')
    expect(screen.queryByText(/꺼진 규칙입니다/)).not.toBeInTheDocument()
    expect(screen.queryByText(/하루 한도가 없는 규칙입니다/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith({
      type: 'EVENT',
      title: '10월 출석 체크',
      subtitle: null,
      description: null,
      bannerImageUrl: null,
      bannerColor: null,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      visible: false,
      sortOrder: 2,
      eventKind: 'ATTENDANCE',
      pointRuleCode: 'DAILY_CHECKIN',
      rewardPoints: 10,
    })
  })

  it('sends null reward when 보상 없음 is chosen', async () => {
    const create = vi.spyOn(promotions, 'createPromotion').mockResolvedValue(checkin)
    renderAt('/promotions/new')
    await userEvent.click(screen.getByLabelText('이벤트'))
    await userEvent.type(screen.getByLabelText('제목'), '출석')
    fillDates('2026-10-01', '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ pointRuleCode: null, rewardPoints: null }))
  })

  it('validates on the client before calling the server', async () => {
    const create = vi.spyOn(promotions, 'createPromotion').mockResolvedValue(exhibition)
    renderAt('/promotions/new')

    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('제목을 입력하세요')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('제목'), '기획전')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('시작일과 종료일을 입력하세요')).toBeInTheDocument()

    fillDates('2026-10-05', '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('종료일은 시작일보다 빠를 수 없습니다')).toBeInTheDocument()

    fillDates('2026-10-01', '2026-10-05')
    await userEvent.type(screen.getByLabelText('배너 색'), 'red')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('배너 색은 #RRGGBB 형식이어야 합니다')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('배너 색'))
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByText('기획전에는 상품을 1개 이상 넣어야 합니다')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it("shows the server's message on 400", async () => {
    vi.spyOn(promotions, 'getPromotion').mockResolvedValue(exhibition)
    vi.spyOn(promotions, 'updatePromotion').mockRejectedValue(new ApiError(400, JSON.stringify({ message: 'productIds: 없는 상품이 있습니다' })))
    renderAt('/promotions/3')

    expect(await screen.findByLabelText('제목')).toHaveValue('가을 신상 기획전')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('productIds: 없는 상품이 있습니다')).toBeInTheDocument()
  })

  it('loads an exhibition for editing: type locked, products flagged, saves in place', async () => {
    vi.spyOn(promotions, 'getPromotion').mockResolvedValue(exhibition)
    const update = vi.spyOn(promotions, 'updatePromotion').mockResolvedValue({ ...exhibition, title: '가을 기획전' })
    renderAt('/promotions/3')

    const title = await screen.findByLabelText('제목')
    expect(screen.getByLabelText('기획전')).toBeDisabled()
    expect(screen.getByLabelText('이벤트')).toBeDisabled()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByLabelText('설명')).toHaveValue('가을 신상품 모음')
    expect(screen.getByLabelText('순서')).toHaveValue(1)
    const hiddenItem = screen.getByText(/모두 우산/).closest('li')!
    expect(within(hiddenItem).getByText('숨김')).toHaveClass('status-badge--cancelled')
    expect(screen.queryByRole('region', { name: '출석 현황' })).not.toBeInTheDocument()

    await userEvent.clear(title)
    await userEvent.type(title, '가을 기획전')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith('3', expect.objectContaining({ type: 'EXHIBITION', title: '가을 기획전', productIds: [1, 2], sortOrder: 1 }))
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
  })

  it('deletes only after the in-page confirmation', async () => {
    vi.spyOn(promotions, 'getPromotion').mockResolvedValue(exhibition)
    const remove = vi.spyOn(promotions, 'deletePromotion').mockResolvedValue(undefined)
    renderAt('/promotions/3')

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    const confirm = screen.getByRole('group', { name: '삭제 확인' })
    expect(within(confirm).getByText("'가을 신상 기획전' 을(를) 삭제할까요?")).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(remove).not.toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: '삭제 확인' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
    expect(remove).toHaveBeenCalledWith('3')
    expect(await screen.findByText('목록 화면')).toBeInTheDocument()
  })

  it('keeps a rule that is no longer in the list and resends its saved points', async () => {
    vi.spyOn(promotions, 'getPromotion').mockResolvedValue({ ...checkin, pointRuleCode: 'GONE', rewardPoints: 30 })
    const update = vi.spyOn(promotions, 'updatePromotion').mockResolvedValue(checkin)
    renderAt('/promotions/4')

    expect(await screen.findByLabelText('보상 포인트 규칙')).toHaveValue('GONE')
    expect(await screen.findByText(/포인트 규칙 목록에 없습니다/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith('4', expect.objectContaining({ pointRuleCode: 'GONE', rewardPoints: 30 }))
  })

  it('shows not found for a missing promotion', async () => {
    vi.spyOn(promotions, 'getPromotion').mockRejectedValue(new ApiError(404, ''))
    renderAt('/promotions/99')
    expect(await screen.findByText('기획전·이벤트를 찾을 수 없습니다')).toBeInTheDocument()
  })

  describe('coupons', () => {
    const welcome = coupon(7, '웰컴 3천원')
    const tenPercent = coupon(8, '10% 할인', { discountType: 'PERCENT', discountValue: 10, maxDiscount: 5000, totalQuantity: null, validUntil: null, validDays: 7 })

    it('creates a 쿠폰 받기 event: hides the point rule, requires a coupon, sends eventKind and couponIds', async () => {
      const search = vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(couponPage([welcome, tenPercent]))
      const create = vi.spyOn(promotions, 'createPromotion').mockResolvedValue(checkin)
      renderAt('/promotions/new')

      await userEvent.click(screen.getByLabelText('이벤트'))
      expect(screen.getByLabelText('출석 체크')).toBeChecked()
      await userEvent.click(screen.getByLabelText('쿠폰 받기'))
      expect(screen.queryByLabelText('보상 포인트 규칙')).not.toBeInTheDocument()
      expect(screen.getByText(/쿠폰 받기 — 기간 동안 버튼 한 번으로/)).toBeInTheDocument()

      await userEvent.type(screen.getByLabelText('제목'), '웰컴 쿠폰팩')
      fillDates('2026-10-01', '2026-10-31')
      await userEvent.click(screen.getByRole('button', { name: '등록' }))
      expect(screen.getByText('쿠폰 받기 이벤트에는 쿠폰을 1개 이상 넣어야 합니다')).toBeInTheDocument()
      expect(create).not.toHaveBeenCalled()

      await userEvent.type(screen.getByLabelText('쿠폰 검색'), '할인')
      await userEvent.click(screen.getByRole('button', { name: '쿠폰 찾기' }))
      expect(search).toHaveBeenCalledWith('할인', 0)
      const results = await screen.findByRole('list', { name: '쿠폰 검색 결과' })
      expect(within(results).getByText(/10% \(최대 5,000원\) · 받은 날부터 7일 · 발급 12장 \/ 무제한 · 사용 3/)).toBeInTheDocument()
      expect(within(results).getByText(/3,000원 · 2026.11.30까지 · 발급 12 \/ 100장 · 사용 3/)).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: '10% 할인 추가' }))
      await userEvent.click(screen.getByRole('button', { name: '웰컴 3천원 추가' }))
      expect(screen.getByRole('button', { name: '웰컴 3천원 추가' })).toBeDisabled()
      const selected = screen.getByRole('list', { name: '이벤트 쿠폰 목록' })
      await userEvent.click(within(selected).getByRole('button', { name: '10% 할인 빼기' }))
      await userEvent.click(screen.getByRole('button', { name: '등록' }))

      expect(create).toHaveBeenCalledWith({
        type: 'EVENT',
        title: '웰컴 쿠폰팩',
        subtitle: null,
        description: null,
        bannerImageUrl: null,
        bannerColor: null,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        visible: true,
        sortOrder: 0,
        eventKind: 'COUPON',
        couponIds: [7],
      })
    })

    it('attaches optional coupons to an exhibition', async () => {
      vi.spyOn(promotions, 'getPromotion').mockResolvedValue({ ...exhibition, coupons: [welcome], couponCount: 1 })
      vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(couponPage([welcome, tenPercent]))
      const update = vi.spyOn(promotions, 'updatePromotion').mockResolvedValue(exhibition)
      renderAt('/promotions/3')

      expect(await screen.findByRole('heading', { name: '기획전 쿠폰 (1)' })).toBeInTheDocument()
      expect(within(screen.getByRole('list', { name: '기획전 쿠폰 목록' })).getByText('웰컴 3천원')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '쿠폰 찾기' }))
      await userEvent.click(await screen.findByRole('button', { name: '10% 할인 추가' }))
      await userEvent.click(screen.getByRole('button', { name: '저장' }))
      expect(update).toHaveBeenCalledWith('3', expect.objectContaining({ productIds: [1, 2], couponIds: [7, 8] }))
      expect(update.mock.calls[0][1]).not.toHaveProperty('eventKind')
    })

    it('loads a 쿠폰 받기 event with its kind locked and no attendance section', async () => {
      const couponEvent: promotions.PromotionDetail = { ...checkin, id: 5, eventKind: 'COUPON', pointRuleCode: null, rewardPoints: null, coupons: [welcome], couponCount: 1 }
      vi.spyOn(promotions, 'getPromotion').mockResolvedValue(couponEvent)
      const attendances = vi.spyOn(promotions, 'getAttendances')
      const update = vi.spyOn(promotions, 'updatePromotion').mockResolvedValue(couponEvent)
      renderAt('/promotions/5')

      expect(await screen.findByLabelText('쿠폰 받기')).toBeChecked()
      expect(screen.getByLabelText('쿠폰 받기')).toBeDisabled()
      expect(screen.getByLabelText('출석 체크')).toBeDisabled()
      expect(screen.getByText(/이벤트 종류는 만든 뒤 바꿀 수 없습니다/)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: '출석 현황' })).not.toBeInTheDocument()
      expect(attendances).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: '저장' }))
      expect(update).toHaveBeenCalledWith('5', expect.objectContaining({ eventKind: 'COUPON', couponIds: [7] }))
    })

    it('stops at 10 coupons', async () => {
      const many = Array.from({ length: 11 }, (_, i) => coupon(100 + i, `쿠폰${i + 1}`))
      vi.spyOn(promotions, 'getPromotion').mockResolvedValue({ ...exhibition, coupons: many.slice(0, 10), couponCount: 10 })
      vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(couponPage(many))
      renderAt('/promotions/3')

      await userEvent.click(await screen.findByRole('button', { name: '쿠폰 찾기' }))
      expect(await screen.findByRole('button', { name: '쿠폰11 추가' })).toBeDisabled()
    })
  })

  describe('attendance section', () => {
    it('pages through attendances of an event, newest first, times in the display zone', async () => {
      localStorage.setItem('modu-admin.timeZone', 'Asia/Seoul')
      vi.spyOn(promotions, 'getPromotion').mockResolvedValue(checkin)
      const attendances = vi.spyOn(promotions, 'getAttendances').mockImplementation(async (_id, page) => ({
        content:
          page === 0
            ? [
                { userId: 'user-a', checkDate: '2026-10-02', rewardPoints: 10, rewardMessage: null, createdAt: '2026-10-01 15:30:00' },
                { userId: 'user-b', checkDate: '2026-10-01', rewardPoints: 0, rewardMessage: '오늘 적립 한도를 넘었습니다', createdAt: '2026-10-01 01:00:00' },
              ]
            : [{ userId: 'user-c', checkDate: '2026-10-01', rewardPoints: 10, rewardMessage: null, createdAt: '2026-09-30 23:00:00' }],
        totalElements: 16,
        totalPages: 2,
        number: page,
        size: 15,
      }))
      renderAt('/promotions/4')

      const section = await screen.findByRole('region', { name: '출석 현황' })
      expect(await within(section).findByText('user-a')).toBeInTheDocument()
      expect(attendances).toHaveBeenCalledWith('4', 0)
      expect(within(section).getByRole('heading', { name: '출석 현황 (16회)' })).toBeInTheDocument()
      const rowA = within(section).getByText('user-a').closest('tr')!
      expect(within(rowA).getByText('2026.10.02')).toBeInTheDocument()
      expect(within(rowA).getByText('10 P')).toBeInTheDocument()
      expect(within(rowA).getByText('2026-10-02 00:30')).toBeInTheDocument()
      const rowB = within(section).getByText('user-b').closest('tr')!
      expect(within(rowB).getByText('0 P')).toBeInTheDocument()
      expect(within(rowB).getByText('오늘 적립 한도를 넘었습니다')).toBeInTheDocument()

      await userEvent.click(within(section).getByRole('button', { name: '다음' }))
      expect(await within(section).findByText('user-c')).toBeInTheDocument()
      expect(attendances).toHaveBeenLastCalledWith('4', 1)
      localStorage.removeItem('modu-admin.timeZone')
    })

    it('says so when nobody has checked in yet', async () => {
      vi.spyOn(promotions, 'getPromotion').mockResolvedValue(checkin)
      renderAt('/promotions/4')
      expect(await screen.findByText('아직 출석한 사람이 없습니다')).toBeInTheDocument()
    })
  })
})
