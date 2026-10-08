import { describe, expect, it } from 'vitest'
import { chatKindOf, lastMessagePreview } from './chatMessage'

const HASH = 'c5d47a1a1f25b1c224ff67d57afc486352fb7c603350b10c2f27215831a701f5'

describe('chatKindOf', () => {
  it('maps chatType 1–4 to text/image/file/audio', () => {
    expect(chatKindOf(1, '안녕')).toBe('text')
    expect(chatKindOf(2, `${HASH}.jpg`)).toBe('image')
    expect(chatKindOf(3, `${HASH}.pdf`)).toBe('file')
    expect(chatKindOf(4, `${HASH}.m4a`)).toBe('audio')
  })

  it('infers the kind from a stored file name when the type says text (old data)', () => {
    expect(chatKindOf(1, `${HASH}.JPG`)).toBe('image')
    expect(chatKindOf(0, `${HASH}.mp3`)).toBe('audio')
    expect(chatKindOf(1, `${HASH}.zip`)).toBe('file')
    expect(chatKindOf(1, 'photo.jpg')).toBe('text')
  })
})

describe('lastMessagePreview', () => {
  it('turns markers and stored names into labels and keeps text', () => {
    expect(lastMessagePreview('image')).toBe('사진')
    expect(lastMessagePreview('file')).toBe('파일')
    expect(lastMessagePreview('audio')).toBe('음성')
    expect(lastMessagePreview(`${HASH}.png`)).toBe('사진')
    expect(lastMessagePreview('파리 가요')).toBe('파리 가요')
    expect(lastMessagePreview(undefined)).toBe('')
  })
})
