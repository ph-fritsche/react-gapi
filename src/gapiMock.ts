import { ClientConfig, gapiError, gapiObject } from './gapi'

export interface userProps {
    id?: string,
    email?: string,
    name?: string,
    givenName?: string,
    familyName?: string,
    imageUrl?: string,
}

export interface user {
    isSignedIn: (scopes: string[], userProps: userProps) => void,
    isNotSignedIn: (scopes: string[], userProps: userProps) => void,
    nextInteraction: () => Promise<void>,
    grantsScopes?: (scopes?: string[] | true, userProps?: userProps) => void,
    deniesAccess?: () => void,
    closesPopup?: () => void,
}

export interface userInternal {
    isSignedIn: boolean,
    scopes: string[],
    props: userProps,
    resolveNextInteraction: () => void,
    promise?: Promise<gapi.auth2.GoogleUser>,
}

export interface registry<T> {
    [k: string]: T,
}

export interface discoveryDocsMock {
    (gapi: gapiObject): void,
}

export interface moduleMock {
    (a: {gapi: gapiObject, user: user, _user: userInternal, _discoveryDocs: registry<discoveryDocsMock>}): void
}

interface registerDiscoveryDocs {
    (o: registry<discoveryDocsMock>): void
}

interface registerModuleMocks {
    (o: registry<moduleMock>): void
}

export function createGapiMock(setWindowProp: string | null = 'gapi')
    : {
        gapi: gapiObject,
        user: user,
        registerModuleMocks: registerModuleMocks,
        registerDiscoveryDocs: registerDiscoveryDocs,
    }
{
    let nextInteraction: Promise<void> | (() => void) | undefined
    const _user: userInternal = {
        isSignedIn: false,
        scopes: [],
        props: {
            id: undefined,
            name: '',
            givenName: '',
            familyName: '',
            imageUrl: '',
            email: '',
        },
        resolveNextInteraction: () => {
            if (typeof(nextInteraction) === 'function') {
                nextInteraction()
                nextInteraction = undefined
            } else if (!nextInteraction) {
                nextInteraction = Promise.resolve()
            }
        },
    }
    const user: user = {
        isSignedIn: (scopes = [], userProps: userProps = {}) => {
            _user.isSignedIn = true,
            _user.scopes = scopes
            _user.props = {..._user.props, ...userProps, id: userProps.id ?? _user.props.id ?? mockId() }
        },
        isNotSignedIn: (scopes = [], userProps: userProps) => {
            _user.isSignedIn = false,
            _user.scopes = scopes
            _user.props = { ..._user.props, ...userProps }
        },
        nextInteraction: () => {
            if (!nextInteraction) {
                return new Promise<void>(res => { nextInteraction = res })
            } else if (nextInteraction instanceof Promise) {
                const p = nextInteraction
                nextInteraction = undefined
                return p
            }
            throw 'user.nextInteraction() was called multiple times before an interaction happened.\n'
                + 'This was probably not intended.'
        },
    }

    const _discoveryDocs: registry<discoveryDocsMock> = {}
    const registerDiscoveryDocs: registerDiscoveryDocs = o => Object.keys(o).forEach(k => _discoveryDocs[k] = o[k])

    const _modules: registry<moduleMock> = {
        auth2: createAuthModuleMock,
        client: createClientModuleMock,
    }
    const registerModuleMocks: registerModuleMocks = o => Object.keys(o).forEach(k => _modules[k] = o[k])

    const gapi: gapiObject = {
        load: (modules: string, then: gapi.CallbackOrConfig) => {
            Promise.all(modules.split(':').map(k => new Promise<void>((res) => {
                res()
                if (!gapi[k]) {
                    gapi[k] = _modules[k]
                        ? _modules[k]({ gapi, user, _user, _discoveryDocs })
                        : (name: string) => ({
                            init: () => notImplemented(`Mock for gapi module "${name}"`),
                        })
                }
                res()
            }))).then(typeof then === 'function' ? then : then.callback)
        },
    }

    if (setWindowProp) {
        (window as unknown as {[k: string]: gapiObject})[setWindowProp] = gapi
    }

    return { gapi, user, registerModuleMocks, registerDiscoveryDocs }
}

function mockId() {
    return Math.random().toString(10).substr(2, 10)
}

function notImplemented(descr: string) {
    return `${descr} is not implemented yet.`
}

function createAuthModuleMock({user, _user}: {user: user, _user: userInternal}) {
    let initConfig: gapi.auth2.ClientConfig
    let authInstance: gapi.auth2.GoogleAuth

    const auth2 = {
        init: (config: gapi.auth2.ClientConfig) => {
            const {
                client_id,
                fetch_basic_profile = true,
                scope = '',
            } = config

            if (!client_id) {
                throw { message: `Missing required parameter 'client_id'`}
            } else if (!fetch_basic_profile && !scope) {
                throw { message: `Missing required parameter 'scope'`}
            }

            if (!initConfig) {
                initConfig = {client_id, fetch_basic_profile, scope}
            } else if (client_id !== initConfig.client_id || fetch_basic_profile !== initConfig.fetch_basic_profile || scope !== initConfig.scope) {
                throw { message: 'gapi.auth2 has been initialized with different options. Consider calling gapi.auth2.getAuthInstance() instead of gapi.auth2.init().' }
            }

            if (!authInstance) {
                const effectiveScope = fetch_basic_profile ? scope + ' openid email profile' : scope
                authInstance = createAuthInstanceMock(fetch_basic_profile, effectiveScope)
            }

            return authInstance
        },
        getAuthInstance: () => authInstance,
        authorize: () => { throw notImplemented('auth2.authorize') },
        enableDebugLogs: () => { throw notImplemented('auth2.enableDebugLogs') },
    }

    function createAuthInstanceMock(fetch_basic_profile: boolean, initScope: string): gapi.auth2.GoogleAuth {
        let currentUser: gapi.auth2.GoogleUser | undefined

        const isSignedInListeners: ((v: boolean) => void)[] = []
        const currentUserListeners: ((v: ReturnType<typeof createCurrentUserMock>) => void)[] = []

        const auth = {
            then: (onInit: (a: gapi.auth2.GoogleAuth) => void, onFailure: (a: gapiError) => void) => {
                Promise.resolve().then(() => onInit(auth), (r) => onFailure(r))
            },
            signIn: ({scope = '', prompt = undefined}: gapi.auth2.SigninOptions = {}): Promise<gapi.auth2.GoogleUser> => {
                const scopeArray = (initScope ?? '' + ' ' + scope).split(' ').filter(k => Boolean(k))
                return requestScopes(scopeArray, prompt)
            },
            signOut: () => new Promise<gapi.auth2.GoogleUser>(res => {
                const isSignedInChanged = _user.isSignedIn

                _user.isSignedIn = false
                currentUser = createCurrentUserMock()

                res(currentUser)

                notifyListeners(isSignedInChanged)
            }),
            disconnect: () => new Promise<void>(res => {
                _user.scopes = []
                auth.signOut().then(() => res())
            }),
            currentUser: {
                // currentUser.get() can return undefined on newly initialized GoogleAuth
                get: () => (currentUser as gapi.auth2.GoogleUser),
                listen: (c: (newCurrentUser: gapi.auth2.GoogleUser) => void) => { currentUserListeners.push(c) },
            },
            isSignedIn: {
                get: () => _user.isSignedIn,
                listen: (c: (newIsSignedIn: boolean) => void) => { isSignedInListeners.push(c) },
            },
            grantOfflineAccess: () => { throw notImplemented('GoogleAuth.grantOfflineAccess') },
            attachClickHandler: () => { throw notImplemented('GoogleAuth.attachClickHandler') },
        }

        if (_user.isSignedIn) {
            currentUser = createCurrentUserMock()
        }

        return auth

        function notifyListeners(isSignedInChanged: boolean) {
            if (isSignedInChanged) {
                isSignedInListeners.forEach(c => c(_user.isSignedIn))
            }
            currentUserListeners.forEach(c => currentUser && c(currentUser))
        }

        function requestScopes(scopes: string[], prompt?: string): Promise<gapi.auth2.GoogleUser> {
            if (_user.promise) {
                throw 'The behavior when a previous Promise is still pending is unknown - call user.grantsScopes() or user.closesPopup()'
            }
            return _user.promise = new Promise((res, rej) => {
                function clearInteraction() {
                    delete user.grantsScopes
                    delete user.closesPopup
                    Promise.resolve().then(() => { delete _user.promise })
                }

                user.grantsScopes = (grantedScopes = true, userProps = {}) => {
                    const isSignedInChanged = !_user.isSignedIn
                    _user.isSignedIn = true

                    if (grantedScopes === true) {
                        grantedScopes = scopes
                    }
                    // openid is always added
                    grantedScopes.push('openid')
                    grantedScopes.forEach(k => {
                        if (!_user.scopes.includes(k)) {
                            _user.scopes.push(k)
                        }

                        // the module adds these scopes automatically
                        if (k === 'profile' && !_user.scopes.includes('https://www.googleapis.com/auth/userinfo.profile')) {
                            _user.scopes.push('https://www.googleapis.com/auth/userinfo.profile')
                        } else if (k === 'email' && !_user.scopes.includes('https://www.googleapis.com/auth/userinfo.email')) {
                            _user.scopes.push('https://www.googleapis.com/auth/userinfo.email')
                        }
                    })

                    _user.props = { ..._user.props, ...userProps, id: userProps?.id ?? _user.props.id ?? mockId() }

                    currentUser = createCurrentUserMock()

                    clearInteraction()
                    res(currentUser)

                    notifyListeners(isSignedInChanged)
                }
                user.deniesAccess = () => {
                    clearInteraction()
                    rej({ error: 'access_denied' })
                }
                user.closesPopup = () => {
                    clearInteraction()
                    rej({ error: 'popup_closed_by_user' })
                }

                if (scopes.every(k => _user.scopes.includes(k))) {
                    // if a user granted scopes before, the popup closes automatically
                    if (_user.isSignedIn && prompt && !['consent', 'select_account'].includes(prompt)) {
                        user.grantsScopes()
                    }
                } else if (prompt === 'none') {
                    rej({ error_subtype: 'access_denied', error: 'immediate_failed' })
                }

                _user.resolveNextInteraction()
            })
        }

        function createCurrentUserMock(): gapi.auth2.GoogleUser {
            const basicProfile = createBasicProfileMock()

            return {
                getId: () => _user.props.id ?? '',
                isSignedIn: () => _user.isSignedIn,
                getHostedDomain: () => { throw notImplemented('GoogleUser.getHostedDomain') },
                getGrantedScopes: () => _user.isSignedIn
                    // when fetch_basic_profile is true, the user can not login without consenting to these scopes
                    ? _user.scopes.concat(fetch_basic_profile ? ['email', 'openid', 'profile'] : []).join(' ')
                    : '',
                getBasicProfile: () => basicProfile,
                getAuthResponse: () => { throw notImplemented('GoogleUser.getHostedDomain') },
                reloadAuthResponse: () => { throw notImplemented('GoogleUser.getHostedDomain') },
                hasGrantedScopes: (scope: string) => scope.split(' ').filter(k => Boolean(k) && !_user.scopes.includes(k)).length > 0,
                grant: (options: { scope?: string, prompt?: string } = {}) => authInstance && authInstance.signIn(options),
                grantOfflineAccess: () => { throw notImplemented('GoogleUser.getHostedDomain') },
                disconnect: () => authInstance && authInstance.disconnect(),
            }

            function createBasicProfileMock(): gapi.auth2.BasicProfile {
                return initConfig?.fetch_basic_profile
                    ? {
                        getId: () => _user.props.id ?? '',
                        getName: () => _user.props.name ?? '',
                        getGivenName: () => _user.props.givenName ?? '',
                        getFamilyName: () => _user.props.familyName ?? '',
                        getImageUrl: () => _user.props.imageUrl ?? '',
                        getEmail: () => _user.props.email ?? '',
                    }
                    : {
                        getId: () => _user.props.id ?? '',
                        getName: () => '',
                        getGivenName: () => '',
                        getFamilyName: () => '',
                        getImageUrl: () => '',
                        getEmail: () => '',
                    }
            }
        }
    }

    return auth2
}

function createClientModuleMock({gapi, _discoveryDocs}: {gapi: gapiObject, _discoveryDocs: registry<discoveryDocsMock>}) {
    const client: gapiObject['client'] = {
        init: ({clientId = undefined, scope = undefined, discoveryDocs = []}: ClientConfig) => new Promise<void>((res, rej) => {
            const p = []

            if (scope) {
                if (gapi.auth2) {
                    p.push(gapi.auth2.init({client_id: clientId, scope}))
                } else {
                    throw 'gapi.auth2 not loaded'
                }
            }

            p.push(...discoveryDocs.map(k => new Promise<void>((res, rej) => {
                try {
                    if (typeof(_discoveryDocs[k]) === 'function') {
                        _discoveryDocs[k](gapi)
                    } else {
                        throw `Tried to load discoveryDocs ${k} - use registerDiscoveryDocs to mock discoveryDocs`
                    }
                    res()
                } catch(e) {
                    rej(e)
                }
            })))

            Promise.all<unknown>(p).then(() => res(), () => rej())
        }),
    }

    return client
}
