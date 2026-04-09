import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getPodLogChunk } from './api'

describe('getPodLogChunk', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('unwraps TypeFirst host-key envelopes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        '10.255.255.254': {
          lines: [{ line: 'hello', container: 'main' }],
          next_cursor: { offset: 1 },
          done: false,
          has_more: true,
        },
      }),
    })

    const out = await getPodLogChunk({ type: 'token', token: 'abc' }, 'pod-1', {
      provider: 'podman',
      waitSeconds: 3,
      maxLines: 50,
      cursor: { offset: 0 },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestURL = String(fetchMock.mock.calls[0][0])
    expect(requestURL).toContain('/api/pods/pod-1/log/chunk')
    expect(requestURL).toContain('provider=podman')
    expect(requestURL).toContain('wait_seconds=3')
    expect(requestURL).toContain('max_lines=50')
    expect(requestURL).toContain('cursor=')

    expect(out).toEqual({
      lines: [{ line: 'hello', container: 'main' }],
      next_cursor: { offset: 1 },
      done: false,
      has_more: true,
    })
  })

  it('passes through direct chunk payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        lines: [{ line: 'direct', container: 'sidecar' }],
        done: true,
        has_more: false,
      }),
    })

    const out = await getPodLogChunk({ type: 'token', token: 'abc' }, 'pod-2')
    expect(out).toEqual({
      lines: [{ line: 'direct', container: 'sidecar' }],
      done: true,
      has_more: false,
    })
  })

  it('uses GH entitlement endpoint when ghSlug is provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ done: false, has_more: false, lines: [] }),
    })

    await getPodLogChunk({ type: 'token', token: 'abc' }, 'pod-3', {
      ghSlug: 'my-org/my-repo',
      provider: 'kubernetes',
      streamToken: 'signed-token-abc',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestURL = String(fetchMock.mock.calls[0][0])
    expect(requestURL).toContain('/api/gh/pods/pod-3/log/chunk/my-org/my-repo')
    expect(requestURL).toContain('provider=kubernetes')
    expect(requestURL).toContain('stream_token=signed-token-abc')
  })
})