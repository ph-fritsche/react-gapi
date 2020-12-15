import React, { useContext } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { GoogleApiContext } from '../src/GoogleApiContext'
import { GoogleApiProvider } from '../src/GoogleApiProvider'
import { createGapiMock } from '../src/gapiMock'

async function renderGoogleApiProvider(mockGapi = true) {
    const mock = mockGapi ? createGapiMock() : undefined

    const context = {}
    function TestComponent() {
        context.current = useContext(GoogleApiContext)
        return null
    }

    const result = render(<GoogleApiProvider clientId="foo"><TestComponent /></GoogleApiProvider>)

    await act(async () => {
        await waitFor(() => expect(context.current.gapi).toBeTruthy())
    })
    expect(context.current.gapi).toBe(window.gapi)

    return {
        ...mock,
        ...result,
        context,
        gapi: context.current.gapi,
        configure: (...a) => context.current.configure(...a),
    }
}

beforeEach(() => {
    window.gapi = undefined
})

it('Provide window.gapi', async () => {
    window.gapi = {}

    const { context } = await renderGoogleApiProvider(false)

    expect(context.current.gapi).toBe(window.gapi)
    expect(context.current.configure).toBeType('function')
})

it('Provide gapi from remote', async () => {
    const { context } = await renderGoogleApiProvider(false)

    expect(context.current.gapi?.load).toBeType('function')
    expect(context.current.configure).toBeType('function')
})

it('Load gapi modules', async () => {
    const { gapi, configure } = await renderGoogleApiProvider()

    const setState = jest.fn()

    expect(configure({modules: ['auth2', 'client']}, setState)).toBe(undefined)

    await waitFor(() => expect(setState).toBeCalled())

    expect(configure({ modules: ['auth2', 'client'] }, setState)).toBe(gapi)

    expect(gapi?.auth2?.init).toBeType('function')
    expect(gapi?.client?.init).toBeType('function')
})

it('Request scope and signIn', async () => {
    const { gapi, configure, user } = await renderGoogleApiProvider()

    const setState = jest.fn()

    expect(configure({scopes: ['foo', 'bar']}, setState)).toBe(undefined)

    await waitFor(() => expect(setState).toBeCalled())

    expect(configure({ scopes: ['foo', 'bar'] }, setState)).toBe(gapi)
    expect(gapi.auth2.getAuthInstance().isSignedIn.get()).toBe(false)

    gapi.auth2.getAuthInstance().signIn()

    user.grantsScopes()

    await waitFor(() => expect(setState).toBeCalledTimes(2))
    expect(gapi.auth2.getAuthInstance().isSignedIn.get()).toBe(true)
})

it('Request discoveryDocs', async () => {
    const { gapi, registerDiscoveryDocs, configure } = await renderGoogleApiProvider()

    registerDiscoveryDocs({
        foo: g => g.client.foo = {},
        bar: g => g.client.bar = {},
    })
    const setState = jest.fn()

    expect(configure({discoveryDocs: ['foo', 'bar']}, setState)).toBe(undefined)

    await waitFor(() => expect(setState).toBeCalled())

    expect(gapi.client.foo).toBeTruthy()
    expect(gapi.client.bar).toBeTruthy()
})
