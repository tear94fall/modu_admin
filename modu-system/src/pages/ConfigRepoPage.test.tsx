import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as configRepo from '../api/configRepo'
import ConfigRepoPage from './ConfigRepoPage'

const files: configRepo.ConfigFileSummary[] = [
  { path: 'application.yml', group: '', name: 'application.yml', size: 1588, modifiedAt: '2026-09-25T00:00:00Z' },
  { path: 'messenger/messenger.yml', group: 'messenger', name: 'messenger.yml', size: 6260, modifiedAt: '2026-09-24T00:00:00Z' },
]

const views: Record<string, configRepo.ConfigFileView> = {
  'application.yml': {
    path: 'application.yml',
    documents: [
      {
        index: 0,
        activateOn: null,
        properties: [
          { key: 'modu.internal-api.token', value: '******', line: 3, protection: 'SECRET' },
          { key: 'eureka.client.service-url.defaultZone', value: 'http://discovery-service:8761/eureka/', line: 9, protection: 'NONE' },
        ],
      },
    ],
  },
  'messenger/messenger.yml': {
    path: 'messenger/messenger.yml',
    documents: [
      {
        index: 0,
        activateOn: null,
        properties: [
          { key: 'spring.datasource.password', value: '******', line: 5, protection: 'ENCRYPTED' },
          { key: 'spring.redis.url', value: 'redis://admin:******@redis:6379', line: 7, protection: 'PARTIAL' },
        ],
      },
      { index: 1, activateOn: 'local', properties: [{ key: 'spring.rabbitmq.host', value: 'localhost', line: 12, protection: 'NONE' }] },
    ],
  },
}

const renderPage = (entry = '/config/files') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ConfigRepoPage />
    </MemoryRouter>,
  )

describe('ConfigRepoPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('Asia/Seoul')
    vi.spyOn(configRepo, 'getConfigFiles').mockResolvedValue(files)
    vi.spyOn(configRepo, 'getConfigFile').mockImplementation((path) => Promise.resolve(views[path]))
  })
  afterEach(() => vi.restoreAllMocks())

  it('opens the first file and shows masked values with their reason', async () => {
    renderPage()

    expect(await screen.findByText('eureka.client.service-url.defaultZone')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'application.yml' })).toBeInTheDocument()
    const tokenRow = screen.getByText('modu.internal-api.token').closest('tr')!
    expect(within(tokenRow).getByText('비밀값')).toBeInTheDocument()
    expect(within(tokenRow).getByText('******')).toBeInTheDocument()
    expect(screen.getByText(/키 2개\(가림 1\)/)).toBeInTheDocument()
    expect(configRepo.getConfigFile).toHaveBeenCalledWith('application.yml')
  })

  it('switches files and labels profile documents', async () => {
    renderPage()
    await screen.findByText('eureka.client.service-url.defaultZone')

    await userEvent.click(screen.getByRole('button', { name: /messenger\.yml/ }))

    expect(await screen.findByText('spring.datasource.password')).toBeInTheDocument()
    expect(screen.getByText('암호화됨')).toBeInTheDocument()
    expect(screen.getByText('redis://admin:******@redis:6379')).toBeInTheDocument()
    expect(screen.getByText('문서 2 · 프로필 local 에서만')).toBeInTheDocument()
  })

  it('filters keys by search and does not search masked values', async () => {
    renderPage('/config/files?file=messenger/messenger.yml')
    await screen.findByText('spring.datasource.password')

    await userEvent.type(screen.getByRole('searchbox', { name: '키 검색' }), 'rabbit')

    expect(screen.queryByText('spring.datasource.password')).not.toBeInTheDocument()
    expect(screen.getByText('spring.rabbitmq.host')).toBeInTheDocument()
    expect(screen.getByText('검색에 맞는 키가 없습니다')).toBeInTheDocument()
  })
})
