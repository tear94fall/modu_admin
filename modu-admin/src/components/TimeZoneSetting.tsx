import { useDisplayTimeZone, browserTimeZone, getStoredTimeZone, setDisplayTimeZone, timeZoneLabel, TIME_ZONE_CHOICES } from '../util/timeZone'

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
        <select
          id="display-time-zone"
          aria-label="표시 시간대"
          value={stored ?? ''}
          onChange={(e) => setDisplayTimeZone(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">브라우저 설정 따르기 · {timeZoneLabel(browser)}</option>
          {choices.map((tz) => (
            <option key={tz} value={tz}>
              {timeZoneLabel(tz)}
            </option>
          ))}
        </select>
      </div>
      <p className="form-hint">
        지금 {timeZoneLabel(current)} 기준으로 보여 줍니다. 서버는 UTC 로 저장하고, 이 설정은 이 브라우저에만 저장됩니다.
      </p>
    </section>
  )
}
