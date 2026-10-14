import { useDisplayTimeZone, browserTimeZone, getStoredTimeZone, setDisplayTimeZone, timeZoneLabel, TIME_ZONE_CHOICES } from '../util/timeZone'
import Select from './Select'

/**
 * 백오피스가 시각을 보여 줄 시간대 고르기. 기본은 브라우저(OS) 시간대를 따른다.
 * 이 브라우저에만 저장되고, 채팅방 목록·상세의 생성 시각·마지막 시각·채팅 시각이 이 시간대로 바뀐다.
 */
export default function TimeZoneSetting() {
  const current = useDisplayTimeZone()
  const stored = getStoredTimeZone()
  const browser = browserTimeZone()
  const choices = TIME_ZONE_CHOICES.includes(browser) ? TIME_ZONE_CHOICES : [browser, ...TIME_ZONE_CHOICES]

  return (
    <section className="form-card time-zone-setting">
      <h2 className="form-heading">표시 시간대</h2>
      <div className="form-field">
        <label htmlFor="display-time-zone">시각을 보여 줄 시간대</label>
        <Select
          id="display-time-zone"
          aria-label="표시 시간대"
          value={stored ?? ''}
          onChange={(v) => setDisplayTimeZone(v === '' ? null : v)}
          options={[
            { value: '', label: `브라우저 설정 따르기 · ${timeZoneLabel(browser)}` },
            ...choices.map((tz) => ({ value: tz, label: timeZoneLabel(tz) })),
          ]}
        />
      </div>
      <p className="form-hint">
        지금 {timeZoneLabel(current)} 기준으로 보여 줍니다. 서버는 UTC 로 저장하고, 이 설정은 이 브라우저에만 저장됩니다.
      </p>
    </section>
  )
}
