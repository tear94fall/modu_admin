import { DEFAULT_CATEGORY_COLOR } from '../api/categories'
import { HEX_COLOR } from '../api/promotions'

/** 테마별로 고른 이모지. 클릭하면 아이콘 칸이 채워진다. */
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: '전자기기', emojis: ['📱', '💻', '🖥️', '⌨️', '🎧', '📷', '⌚', '🎮'] },
  { label: '생활·주방', emojis: ['🏠', '🛋️', '🛏️', '🧺', '🧴', '🍳', '🍽️', '☕'] },
  { label: '패션·뷰티', emojis: ['👕', '👗', '👖', '👟', '👜', '🕶️', '💄', '💍'] },
  { label: '식품', emojis: ['🍎', '🥦', '🥩', '🐟', '🍞', '🍜', '🧃', '🍫'] },
  { label: '문구·도서', emojis: ['📚', '📖', '✏️', '🖊️', '📒', '📎', '✂️', '🎨'] },
  { label: '스포츠·레저', emojis: ['⚽', '🏀', '🎾', '🏋️', '🚴', '⛺', '🎣', '🏊'] },
  { label: '반려·유아', emojis: ['🐶', '🐱', '🦴', '🐾', '🍼', '🧸', '👶', '🚼'] },
  { label: '기타', emojis: ['🎁', '⭐', '🔥', '💡', '🛒', '🏷️', '🌱', '✨'] },
]

/** 아이콘 타일 바탕으로 쓰는 파스텔 색. */
export const ICON_PALETTE = [
  '#FEE2E2',
  '#FFEDD5',
  '#FEF3C7',
  '#FEF9C3',
  '#DCFCE7',
  '#D1FAE5',
  '#CFFAFE',
  '#E0F2FE',
  '#DBEAFE',
  '#E0E7FF',
  '#EDE9FE',
  '#FCE7F3',
]

/** 이모지(없으면 이름 첫 글자)를 색 위에 얹은 둥근 사각형. 앱의 카테고리 타일과 같은 모양. */
export function CategoryIconTile({ icon, color, name, size = 28 }: { icon?: string | null; color?: string | null; name: string; size?: number }) {
  const trimmedIcon = icon?.trim() ?? ''
  const trimmedColor = color?.trim() ?? ''
  const background = HEX_COLOR.test(trimmedColor) ? trimmedColor : DEFAULT_CATEGORY_COLOR
  const letter = Array.from(name.trim())[0] ?? '?'
  return (
    <span
      className={trimmedIcon ? 'category-tile' : 'category-tile category-tile--letter'}
      data-testid="category-tile"
      aria-hidden="true"
      style={{ width: size, height: size, background, fontSize: Math.round(size * (trimmedIcon ? 0.55 : 0.45)), borderRadius: Math.round(size * 0.28) }}
    >
      {trimmedIcon || letter}
    </span>
  )
}

/** 카테고리 폼의 "아이콘" 섹션: 이모지 한 개 + 바탕색. idPrefix 는 한 화면에 여러 폼이 있을 때 label 연결용. */
export function CategoryIconPicker({
  idPrefix,
  icon,
  color,
  onIconChange,
  onColorChange,
}: {
  idPrefix: string
  icon: string
  color: string
  onIconChange: (icon: string) => void
  onColorChange: (color: string) => void
}) {
  const trimmedIcon = icon.trim()
  const trimmedColor = color.trim().toUpperCase()
  return (
    <div className="form-section category-icon-picker">
      <h2 className="form-heading">아이콘</h2>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-icon`}>이모지</label>
        <div className="inline-form">
          <input id={`${idPrefix}-icon`} className="input-xs category-emoji-input" value={icon} onChange={(e) => onIconChange(e.target.value)} />
          <span className="form-hint">이모지 한 개</span>
          {icon !== '' && (
            <button type="button" className="text-button" onClick={() => onIconChange('')}>
              지우기
            </button>
          )}
        </div>
        <div className="emoji-groups">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="emoji-group" role="group" aria-label={group.label}>
              <span className="emoji-group-label">{group.label}</span>
              <span className="emoji-grid">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={trimmedIcon === emoji ? 'emoji-option emoji-option--on' : 'emoji-option'}
                    aria-label={`아이콘 ${emoji}`}
                    aria-pressed={trimmedIcon === emoji}
                    onClick={() => onIconChange(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-color`}>아이콘 색</label>
        <div className="inline-form">
          <input
            type="color"
            aria-label="아이콘 색 고르기"
            className="color-input"
            value={HEX_COLOR.test(trimmedColor) ? trimmedColor.toLowerCase() : DEFAULT_CATEGORY_COLOR.toLowerCase()}
            onChange={(e) => onColorChange(e.target.value.toUpperCase())}
          />
          <input
            id={`${idPrefix}-color`}
            className="input-sm"
            placeholder={DEFAULT_CATEGORY_COLOR}
            maxLength={7}
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
          />
          <span className="palette" role="group" aria-label="아이콘 파스텔 색">
            <button
              type="button"
              className={trimmedColor === '' ? 'palette-swatch palette-swatch--default palette-swatch--on' : 'palette-swatch palette-swatch--default'}
              aria-label="기본색"
              title="기본색"
              onClick={() => onColorChange('')}
            />
            {ICON_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={trimmedColor === c ? 'palette-swatch palette-swatch--on' : 'palette-swatch'}
                style={{ background: c }}
                aria-label={`아이콘 색 ${c}`}
                onClick={() => onColorChange(c)}
              />
            ))}
          </span>
        </div>
        <p className="form-hint">비우면 기본색({DEFAULT_CATEGORY_COLOR})을 씁니다.</p>
      </div>
    </div>
  )
}
