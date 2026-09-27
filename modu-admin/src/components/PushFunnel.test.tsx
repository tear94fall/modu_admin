import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PushFunnelCompact, PushFunnelSteps } from './PushFunnel'

const base = { status: 'SENT' as const, targetDevices: 1200, successCount: 1000, failureCount: 200, openedCount: 250 }

describe('PushFunnelCompact', () => {
  it('보냄·성공·열어 봄 숫자와 열람률, 실패 수를 보여 준다', () => {
    render(<PushFunnelCompact c={base} />)
    expect(screen.getByText('1,200')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('실패 200')).toBeInTheDocument()
  })

  it('예약·취소는 숫자 대신 상태 글자', () => {
    const { rerender } = render(<PushFunnelCompact c={{ ...base, status: 'SCHEDULED' }} />)
    expect(screen.getByText('발송 전')).toBeInTheDocument()
    rerender(<PushFunnelCompact c={{ ...base, status: 'CANCELED' }} />)
    expect(screen.getByText('보내지 않음')).toBeInTheDocument()
  })

  it('성공이 0이면 열람률은 -', () => {
    render(<PushFunnelCompact c={{ ...base, successCount: 0, openedCount: 0, failureCount: 0 }} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})

describe('PushFunnelSteps', () => {
  it('성공은 보낸 기기 대비, 열어 봄은 성공 대비 비율', () => {
    render(<PushFunnelSteps c={base} />)
    expect(screen.getByText('83.3%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })
})
