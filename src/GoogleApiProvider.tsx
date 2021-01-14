import React, { useMemo, useRef } from 'react'
import { useLibrary } from 'react-weblibrary'
import { gapiError, gapiObject } from './gapi'
import { GoogleApiContext, configureOptions, configure } from './GoogleApiContext'

type U<T> = T | undefined

export function GoogleApiProvider({clientId, children}: {clientId: string, children: React.ReactNode}): React.ReactElement {
    const [gapi] = useLibrary('gapi', 'https://apis.google.com/js/api.js') as [g: U<gapiObject>, s: string, t: () => void]

    const requested = useRef<requested>({modules: [], discoveryDocs: [], scopes: []}).current
    const loading = useRef<loading>({modules: [], discoveryDocs: [], scopes: []}).current
    const done = useRef<done>({discoveryDocs: [], scopes: []}).current

    function configure(options: configureOptions, state: configureSetState): U<gapiObject> {
        const modules = (options.modules ?? []).concat(
            options.discoveryDocs?.length ? ['client'] : [],
            options.scopes?.length ? ['auth2'] : [],
        )

        if (gapi) {
            return doConfigure(gapi, clientId, requested, loading, done, {...options, modules}, state)
        }
    }

    const context = useMemo<GoogleApiContext>(() => ({gapi}), [gapi])
    context.configure = gapi ? configure : undefined

    return <GoogleApiContext.Provider value={context}>{children}</GoogleApiContext.Provider>
}

interface done { discoveryDocs: string[], scopes: string[] }
interface requested extends done { modules: string[] }
type loading = requested
type configureSetState = Parameters<configure>[1]

function doConfigure(
    gapi: gapiObject,
    clientId: string,
    requested: requested,
    loading: loading,
    done: done,
    options: configureOptions,
    state: configureSetState,
): U<gapiObject> {
    return load(options, state)

    function load(options: configureOptions, state: configureSetState): U<gapiObject> {
        const { modules = [] } = options

        const missingModules = modules.filter(k => !gapi[k])

        if (!missingModules.length) {
            return init(options, state)
        }

        const loadModules = missingModules.filter(k => !loading.modules.includes(k))

        if (loadModules.length) {
            loading.modules.push(...loadModules)

            gapi.load(missingModules.join(':'), () => {
                loading.modules = loading.modules.filter(k => !missingModules.includes(k))
                init(options, state)
            })
        }
    }

    function init(options: configureOptions, state: configureSetState): U<gapiObject> {
        const { scopes = [], discoveryDocs = [] } = options

        const auth = gapi.auth2?.getAuthInstance()

        const missingScopes = (() => {
            if (!scopes.length || !auth) {
                return scopes
            }
            const grantedScopes = (auth.currentUser.get()?.getGrantedScopes() ?? '').split(' ')
            return scopes.filter(k => !grantedScopes.includes(k))
        })()
        const missingDiscoveryDocs = discoveryDocs.filter(k => !done.discoveryDocs.includes(k))

        const missingScopesNotDone = missingScopes.filter(k => !done.scopes.includes(k))

        // collect missing scopes and discoveryDocs from different hook calls to reduce calls
        // to auth2.init(), GoogleUser.grant() and client.init()

        if (missingScopes.length) {
            const requestScopes = missingScopes.filter(k => !requested.scopes.includes(k))
            requested.scopes.push(...requestScopes)

            // prevent asking for the same scope multiple times
            if (missingScopesNotDone.length) {
                new Promise(() => doInitScopes(options, state))
            }
        }

        if (missingDiscoveryDocs.length) {
            const requestDiscoveryDocs = missingDiscoveryDocs.filter(k => !requested.discoveryDocs.includes(k))
            requested.discoveryDocs.push(...requestDiscoveryDocs)

            new Promise(() => doInitDiscoveryDocs(options, state))
        }

        if (!missingScopesNotDone.length && !missingDiscoveryDocs.length) {
            state(JSON.stringify(options))

            return gapi
        }
    }

    function doInitScopes(options: configureOptions, state: configureSetState): void {
        const loadScopes = requested.scopes.filter(k => !loading.scopes.includes(k))

        if (loadScopes.length && gapi?.auth2) {
            loading.scopes.push(...loadScopes)

            const auth = gapi.auth2.getAuthInstance()
                ?? gapi.auth2.init({
                    client_id: clientId,
                    scope: loadScopes.join(' '),
                })

            if (!options.requestScopes) {
                done.scopes.push(...loadScopes)
                auth.then(() => init(options, state))
                return
            }

            auth.then(() => {
                loading.scopes = loading.scopes.filter(k => !loadScopes.includes(k))

                return (auth.isSignedIn.get()
                    ? auth.currentUser.get().grant({
                        scope: loadScopes.join(' '),
                    })
                    : auth.signIn({
                        scope: loadScopes.join(' '),
                    }))
            }).then(() => {
                done.scopes.push(...loadScopes)
                init(options, state)
            }, ({ error }: gapiError) => {
                done.scopes.push(...loadScopes)
                console.error(`Failed to request scopes: \n${loadScopes.join('\n')}\n\nFailed with:\n${error}`)
            })

        } else {
            // some other hook call already triggered the auth request - wait for it
            setTimeout(() => init(options, state), 100)
        }
    }

    function doInitDiscoveryDocs(options: configureOptions, state: configureSetState): void {
        const loadDiscoveryDocs = requested.discoveryDocs.filter(k => !loading.discoveryDocs.includes(k))

        if (loadDiscoveryDocs.length && gapi?.client) {
            loading.discoveryDocs.push(...loadDiscoveryDocs)

            gapi.client.init({
                discoveryDocs: loadDiscoveryDocs,
            }).then(
                () => {
                    done.discoveryDocs.push(...loadDiscoveryDocs)
                    init(options, state)
                },
                ({ error }: gapiError) => console.error(`Failed to load resources: \n${loadDiscoveryDocs.join('\n')}\n\nFailed with:\n${error}`),
            ).then(() => {
                loading.discoveryDocs = loading.discoveryDocs.filter(k => !loadDiscoveryDocs.includes(k))
            })
        } else {
            // some other hook call already triggered the client.init() - wait for it
            setTimeout(() => init(options, state), 100)
        }
    }
}
