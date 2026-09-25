/** 콘솔마다 출처(포트)가 달라 localStorage 도 따로다. 같은 키를 써도 섞이지 않는다. */
const KEY = 'modu-console-token'
const REFRESH_KEY = 'modu-console-refresh-token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t: string) => localStorage.setItem(KEY, t)
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY)
export const setRefreshToken = (t: string) => localStorage.setItem(REFRESH_KEY, t)
export const clearToken = () => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(REFRESH_KEY)
}
