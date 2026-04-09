import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import LogStreamPage from './LogStreamPage'

const mockGetPodLogChunk = vi.fn()

vi.mock('../api', () => ({
  getPodLogChunk: (...args) => mockGetPodLogChunk(...args),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    creds: { type: 'token', token: 'test' },
  }),
}))

describe('LogStreamPage polling', () => {
  beforeEach(() => {
    mockGetPodLogChunk.mockReset()
  })

  it('stops after first terminal chunk', async () => {
    mockGetPodLogChunk.mockResolvedValue({
      lines: [{ line: '2026-04-07T00:00:00Z done', container: 'main' }],
      done: true,
      has_more: false,
    })

    render(<LogStreamPage provider='podman' podID='pod-123' ghSlug='org/repo' />)

    await waitFor(() => {
      expect(screen.getByText(/Polls:\s*1/)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Lines:\s*1/)).toBeInTheDocument()
      expect(screen.getByText(/Done/)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockGetPodLogChunk).toHaveBeenCalledTimes(1)
    })
  })
})