/** 테스트용 JWT. 서명은 보지 않으니 payload 만 제대로 만든다(base64url). */
export function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o))
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.sig`
}
