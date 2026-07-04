import { describe, expect, it, beforeEach, vi } from 'vitest'
import { completeGitHubLogin, getPodLogChunk, interactEventSession } from './api'

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

  it('sends provider_data as json query when provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ done: false, has_more: false, lines: [] }),
    })

    await getPodLogChunk({ type: 'token', token: 'abc' }, 'pod-4', {
      provider: 'kubernetes',
      providerData: { system: 'k8s_default' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestURL = String(fetchMock.mock.calls[0][0])
    expect(requestURL).toContain('provider=kubernetes')
    expect(requestURL).toContain('provider_data=')
  })
})


describe('completeGitHubLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('surfaces backend 403 error details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ error: 'user not allowed by GitHub login restrictions' }),
    })

    await expect(completeGitHubLogin('abc123')).rejects.toMatchObject({
      status: 403,
      message: 'user not allowed by GitHub login restrictions',
    })
  })
})

describe('interactEventSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts key payload to session interact endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true }),
    })

    await interactEventSession({ type: 'token', token: 'abc' }, 'sess-1', 'approve')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/events/sess-1/interact')
    expect(options.method).toBe('POST')
    expect(options.body).toContain('"key":"approve"')
  })

  it('posts key payload to GH-scoped interact endpoint when ghSlug is provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true }),
    })

    await interactEventSession({ type: 'token', token: 'abc' }, 'sess-2', 'reject', 'my-org/my-repo')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/gh/events/sess-2/interact/my-org/my-repo')
    expect(options.method).toBe('POST')
    expect(options.body).toContain('"key":"reject"')
  })
})
describe('listEngines', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches engine list from /api/engines', async () => {
    const mockData = [{ driver: 'openai', engine: 'gpt-4o' }, { driver: 'openai', engine: 'gpt-4o-mini' }]
    const { listEngines } = await import('./api')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => mockData,
    })

    const out = await listEngines({ type: 'token', token: 'abc' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/engines')
    expect(options.method).toBeUndefined()
    expect(out).toEqual(mockData)
  })
})

describe('startNewConvo with engine/driver', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('includes engine and driver when provided', async () => {
    const { startNewConvo } = await import('./api')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ convo_id: 'convo-123' }),
    })

    await startNewConvo({ type: 'token', token: 'abc' }, 'openai', 'Hello', 'gpt-4o', 'openai')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/api/convos')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.agent).toBe('openai')
    expect(body.text).toBe('Hello')
    expect(body.engine).toBe('gpt-4o')
    expect(body.driver).toBe('openai')
  })

  it('omits engine and driver when not provided', async () => {
    const { startNewConvo } = await import('./api')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ convo_id: 'convo-456' }),
    })

    await startNewConvo({ type: 'token', token: 'abc' }, 'openai', 'Hello')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.agent).toBe('openai')
    expect(body.text).toBe('Hello')
    expect(body.engine).toBeUndefined()
    expect(body.driver).toBeUndefined()
  })
})

describe('startTurn with engine/driver', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('includes engine and driver when provided', async () => {
    const { startTurn } = await import('./api')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true }),
    })

    await startTurn({ type: 'token', token: 'abc' }, 'convo-123', 'Hello', 'gpt-4o', 'openai')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/api/convos/convo-123/turn')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.text).toBe('Hello')
    expect(body.engine).toBe('gpt-4o')
    expect(body.driver).toBe('openai')
  })

  it('omits engine and driver when not provided', async () => {
    const { startTurn } = await import('./api')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ ok: true }),
    })

    await startTurn({ type: 'token', token: 'abc' }, 'convo-123', 'Hello')

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.text).toBe('Hello')
    expect(body.engine).toBeUndefined()
    expect(body.driver).toBeUndefined()
  })
})
