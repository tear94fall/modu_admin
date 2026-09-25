import { api } from '@modu/console-core'

/** 설정 서버(config-service)가 읽는 config-repo 파일 하나. */
export interface ConfigFileSummary {
  /** 'application.yml', 'messenger/messenger.yml' 처럼 config-repo 기준 경로. */
  path: string
  /** 공통 파일은 '', 제품별 폴더 파일은 폴더 이름(messenger, commerce). */
  group: string
  name: string
  size: number
  modifiedAt: string
}

/**
 * 값을 어떻게 보여 주는지.
 * - ENCRYPTED: `{cipher}` 로 암호화된 값이라 가렸다.
 * - SECRET: 키 이름이나 값 모양이 비밀값이라 통째로 가렸다.
 * - PARTIAL: URL 안의 비밀번호만 가렸다.
 */
export type Protection = 'NONE' | 'ENCRYPTED' | 'SECRET' | 'PARTIAL'

export interface ConfigProperty {
  key: string
  value: string
  /** 파일에서의 줄 번호(1부터). properties 파일은 없다. */
  line: number | null
  protection: Protection
}

/** YAML 의 `---` 로 나뉜 문서 하나. activateOn 은 그 문서가 켜지는 프로필. */
export interface ConfigDocument {
  index: number
  activateOn: string | null
  properties: ConfigProperty[]
}

export interface ConfigFileView {
  path: string
  documents: ConfigDocument[]
}

/** 게이트웨이가 직원 토큰(ROLE_SYSTEM)을 확인하고 내부 토큰을 붙여 설정 서버로 넘긴다. */
export const getConfigFiles = () => api<ConfigFileSummary[]>('/config-service/api-admin/config-repo/files')

export const getConfigFile = (path: string) =>
  api<ConfigFileView>(`/config-service/api-admin/config-repo/file?path=${encodeURIComponent(path)}`)

export const PROTECTION_LABELS: Record<Exclude<Protection, 'NONE'>, string> = {
  ENCRYPTED: '암호화됨',
  SECRET: '비밀값',
  PARTIAL: '일부 가림',
}

/** 파일 목록 묶음 이름. */
export const groupLabel = (group: string) => (group === '' ? '공통' : group)

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
