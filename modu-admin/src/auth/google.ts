/**
 * Google Identity Services(브라우저). 버튼을 눌러 받은 credential 이 Google ID 토큰이고, auth-service 의 google_id_token 그랜트로 바꾼다.
 * 웹 클라이언트 ID 는 커머스 웹과 같은 것이다(비밀 아님). Google 콘솔의 "승인된 JavaScript 원본"에 콘솔의 출처
 * (예: http://localhost:5173, http://192.168.0.3:8081)가 등록돼 있어야 버튼이 동작한다.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '529862674339-34f6a7he3npv9kkufh8u8ie6mma3f92j.apps.googleusercontent.com'

export interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup' | 'redirect'; auto_select?: boolean }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'

let loading: Promise<GoogleAccountsId> | null = null

/** GIS 스크립트를 한 번만 불러온다. */
export function loadGoogle(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (!loading) {
    loading = new Promise<GoogleAccountsId>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT
      s.async = true
      s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gis')))
      s.onerror = () => reject(new Error('gis'))
      document.head.appendChild(s)
    }).catch((e: unknown) => {
      // 실패한 로드는 다시 시도할 수 있게 비운다(네트워크가 잠깐 끊겼을 때).
      loading = null
      throw e
    })
  }
  return loading
}

/** 컨테이너에 Google 버튼을 그리고, 사용자가 로그인하면 ID 토큰을 [onCredential] 로 준다. */
export async function renderGoogleButton(parent: HTMLElement, onCredential: (idToken: string) => void): Promise<void> {
  const id = await loadGoogle()
  id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential), ux_mode: 'popup' })
  id.renderButton(parent, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 280 })
}
