/** 회원 이름 첫 글자 동그라미. 프로필 사진은 불러오지 않는다(이 콘솔은 저장소 API 를 부르지 않는다). 색은 회원 번호로 고정. */
export default function MemberAvatar({ id, name, size = 'sm' }: { id: number; name: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`int-avatar int-avatar--${size} int-avatar--c${id % 6}`} aria-hidden="true">
      {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
