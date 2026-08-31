import { useRef } from 'react'

// Compact pill badge that proxies to a visually-hidden native <select>.
// Clicking/tapping the badge opens the underlying select dropdown.
const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 12,
  background: '#1e2438',
  border: '1px solid #2d3148',
  color: '#94a3b8',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

// Kept as a real <select> so it integrates with native selection and
// remains queryable / value-synced for tests and assistive tech.
const hiddenSelectStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
}

export default function BadgeSelect({ value, onChange, options, emptyLabel, disabled, ariaLabel }) {
  const selectRef = useRef(null)

  const selected = (options || []).find((o) => o.value === value)

  const openPicker = () => {
    if (disabled) return
    const select = selectRef.current
    if (!select) return
    // Preferred path: native showPicker (Chrome/Edge 99+, Safari 16+).
    if (typeof select.showPicker === 'function') {
      select.showPicker()
      return
    }
    // Fallback for older browsers: focus the select and open it.
    select.focus()
    select.click()
  }

  return (
    <>
      <button
        type="button"
        role="button"
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        style={badgeStyle}
        onClick={openPicker}
      >
        <span>{selected ? selected.label : (emptyLabel || 'Select')}</span>
        <span aria-hidden="true" style={{ fontSize: 9, color: '#64748b' }}>▾</span>
      </button>
      <select
        ref={selectRef}
        style={hiddenSelectStyle}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-label={ariaLabel}
      >
        {(options || []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </>
  )
}
