import { useEffect, useState } from 'react'

/**
 * Reactively subscribe to a CSS media query.
 *
 * Uses `window.matchMedia` under the hood, listens for change events, and
 * re-renders the consuming component whenever the query result flips. The
 * listener is removed on unmount.
 *
 * @param {string} query - A CSS media query, e.g. "(max-width: 768px)".
 * @returns {boolean} Whether the query currently matches.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mql = window.matchMedia(query)
    // Sync in case the media query string changed between renders.
    setMatches(mql.matches)

    const handleChange = (event) => {
      setMatches(event.matches)
    }

    // Older Safari needs addListener/removeListener; matchMedia's onchange
    // property is preferred when available.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange)
    }

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleChange)
      } else if (typeof mql.removeListener === 'function') {
        mql.removeListener(handleChange)
      }
    }
  }, [query])

  return matches
}
