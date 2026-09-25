import { beforeEach, describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/jwt'
import { hasRole, tokenAccount, tokenRoles } from './roles'
import { setToken } from './token'

describe('roles', () => {
  beforeEach(() => localStorage.clear())

  it('reads the roles claim of the stored access token', () => {
    setToken(fakeJwt({ sub: 'u1', email: 'staff@modu.local', roles: ['ROLE_SUPER', 'ROLE_ADMIN', 'ROLE_SYSTEM', 'ROLE_INTERNAL'] }))
    expect(tokenRoles()).toEqual(['ROLE_SUPER', 'ROLE_ADMIN', 'ROLE_SYSTEM', 'ROLE_INTERNAL'])
    expect(hasRole('ROLE_SYSTEM')).toBe(true)
    expect(hasRole('ROLE_USER')).toBe(false)
    expect(tokenAccount()).toBe('staff@modu.local')
  })

  it('accepts a single string role and falls back to sub for the account', () => {
    const token = fakeJwt({ sub: 'u1', roles: 'ROLE_INTERNAL' })
    expect(tokenRoles(token)).toEqual(['ROLE_INTERNAL'])
    expect(tokenAccount(token)).toBe('u1')
  })

  it('tolerates a missing or broken token', () => {
    expect(tokenRoles()).toEqual([])
    expect(hasRole('ROLE_ADMIN')).toBe(false)
    for (const bad of ['garbage', 'a.b.c', 'a.!!!.c', `x.${btoa('[1,2]')}.y`, `x.${btoa('{"roles":[1,null]}')}.y`]) {
      expect(tokenRoles(bad)).toEqual([])
    }
    expect(tokenAccount('garbage')).toBeNull()
  })
})
