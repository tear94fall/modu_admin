/**
 * 채팅 메시지 종류. 서버(chat-service ChatType, ws-service ChatType)와 앱(modu-chat core/model/ChatType)이 쓰는 chatType 정수:
 * 1 글, 2 사진, 3 파일, 4 음성, 5 초대 안내, 6 나감 안내, 7 이름 변경 안내(0 은 앱의 INVALID).
 * 사진·파일·음성의 본문은 저장소 파일 이름(64자리 16진수 + 확장자)이다.
 */
export const CHAT_TYPE = { TEXT: 1, IMAGE: 2, FILE: 3, AUDIO: 4, SYSTEM_INVITE: 5, SYSTEM_LEAVE: 6, SYSTEM_RENAME: 7 } as const

/** 서버가 남기는 안내 행의 타입. 늘어날 때 여기만 고치면 된다. */
const SYSTEM_TYPES: ReadonlySet<number> = new Set([CHAT_TYPE.SYSTEM_INVITE, CHAT_TYPE.SYSTEM_LEAVE, CHAT_TYPE.SYSTEM_RENAME])

/** system = 서버가 남긴 안내 행(초대·나감·이름 변경). 본문이 곧 보여 줄 문장이고 sender 는 그 사건의 주인공이다. */
export type ChatKind = 'text' | 'image' | 'file' | 'audio' | 'system'

/** 본문 대신 "사진"·"파일"·"음성" 으로 보여 주는 종류. 글·안내 행은 문장을 그대로 쓴다. */
export type FileKind = Exclude<ChatKind, 'text' | 'system'>

export const CHAT_KIND_LABELS: Record<FileKind, string> = { image: '사진', file: '파일', audio: '음성' }

/** 방의 lastChatMsg 에 서버가 본문 대신 넣는 표식(ws-service ChatType.chatTypeStr). 안내 행은 표식 없이 문장이 그대로 온다. */
const MARKERS: Record<string, FileKind> = { image: 'image', file: 'file', audio: 'audio' }

const STORED_FILE = /^[0-9a-f]{64}\.([a-z0-9]+)$/i
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'])
const AUDIO_EXT = new Set(['m4a', 'mp3', 'aac', 'wav', 'ogg', 'amr', '3gp'])

/** 저장소 파일 이름이면 확장자로 종류를, 아니면 null. 표식 없이 파일 이름이 글로 저장된 옛 데이터용(앱 ChatPreview 와 같은 규칙). */
function kindOfStoredName(message: string): FileKind | null {
  const ext = STORED_FILE.exec(message.trim())?.[1]?.toLowerCase()
  if (!ext) return null
  if (IMAGE_EXT.has(ext)) return 'image'
  if (AUDIO_EXT.has(ext)) return 'audio'
  return 'file'
}

/** 메시지 한 건의 종류. chatType 이 우선이고, 글(또는 알 수 없는 값)인데 본문이 저장 파일 이름이면 확장자로 정한다. */
export function chatKindOf(chatType: number, message: string): ChatKind {
  if (SYSTEM_TYPES.has(chatType)) return 'system'
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
