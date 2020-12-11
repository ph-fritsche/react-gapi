import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useLibray } from 'react-weblibrary'
import { GoogleApiContext } from './GoogleApiContext'

export function GoogleApiProvider({clientId, children}) {
    const [gapi] = useLibray('gapi', 'https://apis.google.com/js/api.js')

    const requested = useRef({modules: [], discoveryDocs: [], scopes: []}).current
    const loading = useRef({modules: [], discoveryDocs: [], scopes: []}).current
    const done = useRef({discoveryDocs: [], scopes: []}).current

    function configure(options, state) {
        const {discoveryDocs = [], scopes = []} = options
        const modules = [discoveryDocs?.length && 'client', scopes?.length && 'auth2'].filter(k => Boolean(k)).concat(options.modules ?? [])

        return load({discoveryDocs, scopes, modules}, state)
    }

    function load(options, state) {
        const { modules } = options

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

    function init(options, state) {
        const { scopes, discoveryDocs } = options

        const auth = gapi.auth2.getAuthInstance()

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

    function doInitScopes(options, state) {
        const loadScopes = requested.scopes.filter(k => !loading.scopes.includes(k))

        if (loadScopes.length) {
            const auth = gapi.auth2.getAuthInstance()

            loading.scopes.push(...loadScopes)

            const f = !auth
                ? gapi.auth2.init({
                    client_id: clientId,
                    scope: loadScopes.join(' '),
                })
                : auth.currentUser.get().grant({
                    scope: loadScopes.join(' '),
                })

            f.then(
                () => init(options, state),
                ({ error }) => console.error(`Failed to request scopes: \n${loadScopes.join('\n')}\n\nFailed with:\n${error}`),
            ).then(() => {
                loading.scopes = loading.scopes.filter(k => !loadScopes.includes(k))
                done.scopes.push(...loadScopes)
            })

        } else {
            // some other hook call already triggered the auth request - wait for it
            setTimeout(() => init(options, state), 100)
        }
    }

    function doInitDiscoveryDocs(options, state) {
        const loadDiscoveryDocs = requested.discoveryDocs.filter(k => !loading.discoveryDocs.includes(k))

        if (loadDiscoveryDocs.length) {
            loading.discoveryDocs.push(...loadDiscoveryDocs)

            gapi.client.init({
                discoveryDocs: loadDiscoveryDocs,
            }).then(
                () => {
                    done.discoveryDocs.push(...loadDiscoveryDocs)
                    init(options, state)
                },
                ({error}) => console.error(`Failed to load resources: \n${loadDiscoveryDocs.join('\n')}\n\nFailed with:\n${error}`),
            ).then(() => {
                loading.discoveryDocs = loading.discoveryDocs.filter(k => !loadDiscoveryDocs.includes(k))
            })
        } else {
            // some other hook call already triggered the client.init() - wait for it
            setTimeout(() => init(options, state), 100)
        }
    }

    const context = useMemo(() => ({gapi}), [gapi])
    context.configure = gapi ? configure : undefined

    return <GoogleApiContext.Provider value={context}>{children}</GoogleApiContext.Provider>
}

GoogleApiProvider.propTypes = {
    clientId: PropTypes.string.isRequired,
    children: PropTypes.element,
}
