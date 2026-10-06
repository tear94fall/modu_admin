import { getDeployment, isFinished, listDeployments, type Deployment } from '../api/deploy'

/**
 * 열려 있는 진행 패널의 배포 id. 새로고침해도 배포는 deploy-service 에서 계속 돌므로, 다시 들어오면 그 패널을 되살린다.
 * 세션 저장소(탭 단위)에 `modu-deploy-open:<service>` = 배포 id 로 둔다.
 */
const PREFIX = 'modu-deploy-open:'

export function rememberOpen(service: string, id: string): void {
  try {
    sessionStorage.setItem(PREFIX + service, id)
  } catch {
    // 저장소를 못 쓰면 새로고침 때 못 되살릴 뿐이다.
  }
}

export function forgetOpen(service: string): void {
  try {
    sessionStorage.removeItem(PREFIX + service)
  } catch {
    // 위와 같다.
  }
}

function readOpen(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const id = sessionStorage.getItem(key)
      if (id) out[key.slice(PREFIX.length)] = id
    }
  } catch {
    // 비공개 창 등.
  }
  return out
}

/**
 * 화면을 열 때 되살릴 배포. (1) 이력에서 RUNNING 인 것은 모두, (2) 세션에 적어 둔 것은 그 id 를 읽어서 —
 * 아직 RUNNING 이면 그대로, 이미 끝났으면 끝난 모습을 한 번 보여 주고 세션에서 지운다. 서비스당 하나.
 * [service] 를 주면 그 서비스만 본다.
 */
export async function findResumable(service?: string): Promise<Deployment[]> {
  const found = new Map<string, Deployment>()
  for (const d of await listDeployments(service, 50)) {
    if (d.status === 'RUNNING' && !found.has(d.service)) found.set(d.service, d)
  }
  for (const [svc, id] of Object.entries(readOpen())) {
    if (service && svc !== service) continue
    if (found.has(svc)) continue
    try {
      const d = await getDeployment(id)
      found.set(svc, d)
      if (isFinished(d)) forgetOpen(svc)
    } catch {
      forgetOpen(svc)
    }
  }
  return [...found.values()]
}
