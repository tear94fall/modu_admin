/**
 * 채팅 메시지 종류. 서버(chat-service ChatType, ws-service ChatType)와 앱(modu-chat core/model/ChatType)이 쓰는 chatType 정수:
 * 1 글, 2 사진, 3 파일, 4 음성(0 은 앱의 INVALID). 사진·파일·음성의 본문은 저장소 파일 이름(64자리 16진수 + 확장자)이다.
 */
export const CHAT_TYPE = { TEXT: 1, IMAGE: 2, FILE: 3, AUDIO: 4 } as const

export type ChatKind = 'text' | 'image' | 'file' | 'audio'

export const CHAT_KIND_LABELS: Record<Exclude<ChatKind, 'text'>, string> = { image: '사진', file: '파일', audio: '음성' }

/** 방의 lastChatMsg 에 서버가 본문 대신 넣는 표식(ws-service ChatType.chatTypeStr). */
const MARKERS: Record<string, Exclude<ChatKind, 'text'>> = { image: 'image', file: 'file', audio: 'audio' }

const STORED_FILE = /^[0-9a-f]{64}\.([a-z0-9]+)$/i
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'])
const AUDIO_EXT = new Set(['m4a', 'mp3', 'aac', 'wav', 'ogg', 'amr', '3gp'])

/** 저장소 파일 이름이면 확장자로 종류를, 아니면 null. 표식 없이 파일 이름이 글로 저장된 옛 데이터용(앱 ChatPreview 와 같은 규칙). */
function kindOfStoredName(message: string): Exclude<ChatKind, 'text'> | null {
  const ext = STORED_FILE.exec(message.trim())?.[1]?.toLowerCase()
  if (!ext) return null
  if (IMAGE_EXT.has(ext)) return 'image'
  if (AUDIO_EXT.has(ext)) return 'audio'
  return 'file'
}

/** 메시지 한 건의 종류. chatType 이 우선이고, 글(또는 알 수 없는 값)인데 본문이 저장 파일 이름이면 확장자로 정한다. */
export function chatKindOf(chatType: number, message: string): ChatKind {
  if (chatType === CHAT_TYPE.IMAGE) return 'image'
  if (chatType === CHAT_TYPE.FILE) return 'file'
  if (chatType === CHAT_TYPE.AUDIO) return 'audio'
  return kindOfStoredName(message) ?? 'text'
}

/** 방 목록·상세의 마지막 메시지 미리보기: 표식이나 저장 파일 이름이면 "사진"·"파일"·"음성", 글이면 그대로. */
export function lastMessagePreview(lastChatMsg: string | null | undefined): string {
  if (!lastChatMsg) return ''
  const kind = MARKERS[lastChatMsg] ?? kindOfStoredName(lastChatMsg)
  return kind ? CHAT_KIND_LABELS[kind] : lastChatMsg
}
