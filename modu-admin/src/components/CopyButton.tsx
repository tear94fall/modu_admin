import { useEffect, useRef, useState } from 'react'

/** 값(사용자 ID·채팅방 ID) 복사 아이콘 버튼. 클립보드를 못 쓰면(권한·비보안 컨텍스트) 조용히 "복사 실패"만 잠깐 보인다. */
export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1500)
  }
  return (
    <button
      type="button"
      className={`copy-btn copy-btn--icon${state !== 'idle' ? ' copy-btn--done' : ''}`}
      onClick={copy}
      aria-label={label}
      title={state === 'copied' ? '복사됨' : state === 'failed' ? '복사 실패' : '복사'}
    >
      {state === 'idle' ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.5 10.5h-.3A1.2 1.2 0 0 1 2 9.3V3.2A1.2 1.2 0 0 1 3.2 2h6.1a1.2 1.2 0 0 1 1.2 1.2v.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      ) : (
        <span className="copy-btn-text">{state === 'copied' ? '복사됨' : '실패'}</span>
      )}
    </button>
  )
}
