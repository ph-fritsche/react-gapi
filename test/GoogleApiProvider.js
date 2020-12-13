import React, { useContext } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { GoogleApiContext } from '../src/GoogleApiContext'
import { GoogleApiProvider } from '../src/GoogleApiProvider'
import { createGapiMock } from './_gapiMock'

async function renderGoogleApiProvider() {
    const context = {}
    function TestComponent() {
        context.current = useContext(GoogleApiContext)
        return null
    }

    const result = render(<GoogleApiProvider clientId="foo"><TestComponent /></GoogleApiProvider>)

    await act(async () => {
        await waitFor(() => expect(context.current.gapi).toBeTruthy())
    })

    return {
        ...result,
        context,
    }
}

beforeEach(() => {
    window.gapi = undefined
})

it('Provide window.gapi', async () => {
    window.gapi = {}

    const { context } = await renderGoogleApiProvider()

    expect(context.current.gapi).toBe(window.gapi)
    expect(typeof(context.current.configure)).toBe('function')
})

it('Provide gapi from remote', async () => {
    const { context } = await renderGoogleApiProvider()

    expect(typeof(context.current.gapi?.load)).toBe('function')
    expect(typeof (context.current.configure)).toBe('function')
})

it('Load gapi modules', async () => {
    createGapiMock()
    const { context } = await renderGoogleApiProvider()

    context.current.configure({modules: ['auth2', 'client']}, () => {})

    await waitFor(() => {
        expect(typeof(context.current.gapi?.auth2?.init)).toBe('function')
        expect(typeof(context.current.gapi?.client?.init)).toBe('function')
    })
})

it('Request scope', async () => {
    const { user } = createGapiMock()
    const { context } = await renderGoogleApiProvider()

    const setState = jest.fn()

    expect(context.current.configure({scopes: ['foo', 'bar']}, setState)).toBe(undefined)

    await waitFor(() => expect(typeof(user.grantsScopes)).toBe('function'))

    user.grantsScopes(['foo', 'bar'])

    await waitFor(() => expect(setState).toBeCalled())

    expect(context.current.configure({scopes: ['foo', 'bar'] }, setState)).toBeTruthy()
})

it('Request discoveryDocs', async () => {
    const { registerDiscoveryDocs } = createGapiMock()
    const { context } = await renderGoogleApiProvider()

    registerDiscoveryDocs({
        foo: g => g.client.foo = {},
        bar: g => g.client.bar = {},
    })
    const setState = jest.fn()

    expect(context.current.configure({discoveryDocs: ['foo', 'bar']}, setState)).toBe(undefined)

    await waitFor(() => expect(setState).toBeCalled())

    expect(context.current.gapi.client.foo).toBeTruthy()
    expect(context.current.gapi.client.bar).toBeTruthy()
})
