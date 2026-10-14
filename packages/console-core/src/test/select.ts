import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * 직접 그리는 드롭다운(components/Select)에서 항목 고르기 — 상자(combobox)를 눌러 목록을 열고 항목(option)을 누른다.
 * combobox 는 이름(aria-label 이나 연결된 label 글자)이나 요소로 넘긴다.
 */
export async function chooseOption(user: Pick<UserEvent, 'click'>, combobox: string | HTMLElement, optionLabel: string | RegExp) {
  const trigger = typeof combobox === 'string' ? screen.getByRole('combobox', { name: combobox }) : combobox
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: optionLabel }))
}
