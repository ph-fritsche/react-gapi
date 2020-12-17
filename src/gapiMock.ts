export function createGapiMock(setWindowProp = 'gapi') {
    const gapi = {}

    let nextInteraction
    const _user = {
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
    const user = {
        isSignedIn: (scopes = [], userProps = {}) => {
            _user.isSignedIn = true,
            _user.scopes = scopes
            _user.props = {..._user.props, ...userProps, id: userProps.id ?? _user.props.id ?? mockId() }
        },
        isNotSignedIn: (scopes = [], userProps) => {
            _user.isSignedIn = false,
            _user.scopes = scopes
            _user.props = { ..._user.props, ...userProps }
        },
        nextInteraction: () => {
            if (!nextInteraction) {
                return new Promise(res => { nextInteraction = res })
            } else if (nextInteraction instanceof Promise) {
                const p = nextInteraction
                nextInteraction = undefined
                return p
            }
        },
    }

    const _discoveryDocs = {}
    const registerDiscoveryDocs = o => Object.keys(o).forEach(k => _discoveryDocs[k] = o[k])

    const _createGapiModuleMocks = {
        auth2: createAuthModuleMock,
        client: createClientModuleMock,
        undefined: name => {
            const module = {}
            module.init = jest.fn(() => notImplemented(`Mock for gapi module "${name}"`))
        },
    }
    const registerModuleMocks = o => Object.keys(o).forEach(k => _createGapiModuleMocks[k] = o[k])

    gapi.load = jest.fn((modules, then) => {
        Promise.all(String(modules).split(':').map(k => new Promise((res) => {
            if (!gapi[k]) {
                gapi[k] = _createGapiModuleMocks[k] ? _createGapiModuleMocks[k]({ gapi, user, _user, _discoveryDocs }) : _createGapiModuleMocks['undefined'](k)
            }
            res()
        }))).then(() => then())
    })

    if (setWindowProp) {
        window[setWindowProp] = gapi
    }

    return { gapi, user, registerModuleMocks, registerDiscoveryDocs }
}

function mockId() {
    return Math.random().toString(10).substr(2, 10)
}

function notImplemented(descr) {
    throw `${descr} is not implemented yet.`
}

function createAuthModuleMock({user, _user}) {
    let initConfig
    let authInstance
    let currentUser
    let isSignedInListeners = []
    let currentUserListeners = []

    const auth2 = {
        init: ({ client_id, fetch_basic_profile = true, scope}) => {
            if (!client_id) {
                throw { message: `Missing required parameter 'client_id'`}
            }

            if (fetch_basic_profile) {
                scope = (scope ?? '') + ' openid email profile'
            } else if (!scope) {
                throw { message: `Missing required parameter 'scope'`}
            }

            if (!initConfig) {
                initConfig = {client_id, fetch_basic_profile, scope}
            } else if (client_id !== initConfig.client_id || fetch_basic_profile !== initConfig.fetch_basic_profile || scope !== initConfig.scope) {
                throw { message: 'gapi.auth2 has been initialized with different options. Consider calling gapi.auth2.getAuthInstance() instead of gapi.auth2.init().' }
            }

            if (!authInstance) {
                authInstance = createAuthInstanceMock()
                return requestScopes((scope ?? '').split(' ').filter(k => Boolean(k)), 'auth')
            } else {
                return Promise.resolve(authInstance)
            }
        },
        getAuthInstance: () => authInstance,
        authorize: () => notImplemented('auth2.authorize'),
        enableDebugLogs: () => notImplemented('auth2.enableDebugLogs'),
    }

    function notifyListeners(isSignedInChanged) {
        if (isSignedInChanged) {
            isSignedInListeners.forEach(c => c(_user.isSignedIn))
        }
        currentUserListeners.forEach(c => c(currentUser))
    }

    function requestScopes(scopes = [], authOrUser = 'user', prompt) {
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

                notifyListeners(isSignedInChanged)

                clearInteraction()
                res(authOrUser === 'auth' ? authInstance : currentUser)
            }
            user.deniesAccess = () => {
                clearInteraction()
                rej({error: 'access_denied'})
            }
            user.closesPopup = () => {
                clearInteraction()
                rej({error: 'popup_closed_by_user'})
            }

            if (authOrUser === 'user') {
                if (scopes.every(k => _user.scopes.includes(k))) {
                    // if a user granted scopes before, the popup closes automatically
                    if (_user.loggedIn && !['consent', 'select_account'].includes(prompt)) {
                        user.grantsScopes()
                    }
                } else if (prompt === 'none') {
                    rej({ error_subtype: 'access_denied', error: 'immediate_failed' })
                }

                _user.resolveNextInteraction()
            } else if (authOrUser === 'auth') {
                if (_user.isSignedIn) {
                    currentUser = createCurrentUserMock()
                    notifyListeners(true)
                }

                clearInteraction()
                res(authInstance)
            }
        })
    }

    function createAuthInstanceMock() {
        return {
            signIn: ({scope = '', prompt} = {}) => requestScopes((initConfig.scope + ' ' + scope).split(' ').filter(k => Boolean(k)), 'user', prompt),
            signOut: () => new Promise(res => {
                const isSignedInChanged = _user.isSignedIn

                _user.isSignedIn = false
                currentUser = createCurrentUserMock()

                notifyListeners(isSignedInChanged)

                res(auth2.getAuthInstance().currentUser.get())
            }),
            disconnect: () => new Promise(res => {
                _user.scopes = []
                authInstance.signOut.then(r => res(r))
            }),
            currentUser: {
                get: () => currentUser,
                listen: (c) => { currentUserListeners.push(c) },
            },
            isSignedIn: {
                get: () => _user.isSignedIn,
                listen: (c) => { isSignedInListeners.push(c) },
            },
            grantOfflineAccess: () => notImplemented('GoogleAuth.grantOfflineAccess'),
            attachClickHandler: () => notImplemented('GoogleAuth.attachClickHandler'),
        }
    }

    function createCurrentUserMock() {
        const basicProfile = createBasicProfileMock()

        return {
            getId: () => _user.props.id,
            isSignedIn: () => _user.isSignedIn,
            getHostedDomain: () => notImplemented('GoogleUser.getHostedDomain'),
            getGrantedScopes: () => _user.isSignedIn
                // when fetch_basic_profile is true, the user can not login without consenting to these scopes
                ? _user.scopes.concat(initConfig.fetch_basic_profile ? ['email', 'openid', 'profile'] : []).join(' ')
                : '',
            getBasicProfile: () => basicProfile,
            getAuthResponse: () => notImplemented('GoogleUser.getAuthResponse'),
            reloadAuthResponse: () => notImplemented('GoogleUser.reloadAuthResponse'),
            hasGrantedScopes: scope => String(scope).split(' ').filter(k => Boolean(k) && !_user.scopes.includes(k)).length > 0,
            grant: (options) => authInstance.signIn(options),
            grantOfflineAccess: () => notImplemented('GoogleUser.grantOfflineAccess'),
            disconnect: () => authInstance.disconnect(),
        }
    }

    function createBasicProfileMock() {
        return initConfig.fetch_basic_profile
            ? {
                getId: () => _user.props.id,
                getName: () => _user.props.name ?? '',
                getGivenName: () => _user.props.givenName ?? '',
                getFamilyName: () => _user.props.familyName ?? '',
                getImageUrl: () => _user.props.imageUrl ?? '',
                getEmail: () => _user.props.email ?? '',
            }
            : {
                getId: () => _user.props.id,
                getName: () => '',
                getGivenName: () => '',
                getFamilyName: () => '',
                getImageUrl: () => '',
                getEmail: () => '',
            }
    }

    return auth2
}

function createClientModuleMock({gapi, _discoveryDocs}) {
    const client = {}

    client.init = ({client_id, scope, discoveryDocs = []}) => {
        const p = []

        if (scope) {
            p.push(gapi.auth2.init({client_id, scope}))
        }

        p.push(...discoveryDocs.map(k => new Promise((res, rej) => {
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

        return Promise.all(p)
    }

    return client
}
