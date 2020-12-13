export function createGapiMock() {
    const gapi = {}

    const _user = {
        id: undefined,
        isSignedIn: false,
        scopes: [],
    }
    const user = {
        isSignedIn: (scopes = [], id = Math.random().toString(10).substr(2, 10)) => {
            _user.id = id
            _user.isSignedIn = true,
            _user.scopes = scopes
        },
        isNotSignedIn: () => {
            _user.id = undefined
            _user.isSignedIn = false,
            _user.scopes = []
        },
    }

    const _discoveryDocs = {}
    const registerDiscoveryDocs = o => Object.keys(o).forEach(k => _discoveryDocs[k] = o[k])

    gapi.load = jest.fn((modules, then) => {
        Promise.all(String(modules).split(':').map(k => new Promise((res) => {
            if (!gapi[k]) {
                gapi[k] = createGapiModuleMocks[k] ? createGapiModuleMocks[k]({gapi, user, _user, _discoveryDocs}) : createGapiModuleMocks['undefined'](k)
            }
            res()
        }))).then(() => then())
    })

    window.gapi = gapi

    return { gapi, user, registerDiscoveryDocs }
}

const createGapiModuleMocks = {
    auth2: createAuthModuleMock,
    client: createClientModuleMock,
    undefined: name => {
        const module = {}
        module.init = jest.fn(() => notImplemented(`Mock for gapi module "${name}"`))
    },
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
        init: ({ client_id, scope }) => {
            if (!initConfig) {
                initConfig = { client_id }
            }

            authInstance = createAuthInstanceMock()

            return requestScopes(scope.split(' ').filter(k => Boolean(k)))
        },
        getAuthInstance: () => authInstance,
    }

    function notifyListeners(isSignedInChanged) {
        if (isSignedInChanged) {
            isSignedInListeners.forEach(c => c(_user.isSignedIn))
        }
        currentUserListeners.forEach(c => c(currentUser))
    }

    function requestScopes(scopes = [], authOrUser = 'auth') {
        if (!initConfig.client_id) {
            throw 'client_id has to be defined before requesting scopes'
        }
        if (_user.promise) {
            throw 'The behavior when a previous Promise is still pending is not known - call user.grantsScopes() or user.closesPopup()'
        }
        return _user.promise = new Promise((res, rej) => {
            user.grantsScopes = (grantedScopes) => {
                const isSignedInChanged = !_user.isSignedIn

                user.isSignedIn(_user.scopes.concat(grantedScopes.filter(k => !_user.scopes.includes(k))), _user.id)
                currentUser = createCurrentUserMock()

                notifyListeners(isSignedInChanged)

                delete user.grantsScopes
                delete user.closesPopup

                res(authOrUser === 'auth' ? auth2.getAuthInstance() : auth2.getAuthInstance().currentUser.get())
                delete _user.promise
            }
            user.closesPopup = () => {
                delete user.grantsScopes
                delete user.closesPopup

                rej({error: 'popup_closed_by_user'})
                delete _user.promise
            }

            // if a user granted scopes before, the popup closes automatically
            if (_user.loggedIn && scopes.every(k => _user.scopes.includes(k))) {
                user.grantsScopes()
            }
        })
    }

    function createAuthInstanceMock() {
        const signIn = ({ scope }) => requestScopes(scope.split(' ').filter(k => Boolean(k)), 'user')
        const signOut = () => new Promise(res => {
            const isSignedInChanged = _user.isSignedIn

            _user.isSignedIn = false
            currentUser = createCurrentUserMock()

            notifyListeners(isSignedInChanged)

            res(auth2.getAuthInstance().currentUser.get())
        })
        const disconnect = () => new Promise(res => {
            _user.scopes = []
            signOut.then(r => res(r))
        })

        return {
            signIn,
            signOut,
            disconnect,
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
        return {
            getId: () => _user.id,
            isSignedIn: () => _user.isSignedIn,
            getHostedDomain: () => notImplemented('GoogleUser.getHostedDomain'),
            getGrantedScopes: () => _user.scopes.join(' '),
            getBasicProfile: createBasicProfileMock(),
            getAuthResponse: () => notImplemented('GoogleUser.getAuthResponse'),
            reloadAuthResponse: () => notImplemented('GoogleUser.reloadAuthResponse'),
            hasGrantedScopes: scope => String(scope).split(' ').filter(k => Boolean(k) && !_user.scopes.includes(k)).length > 0,
            grant: (options) => authInstance.signIn(options),
            grantOfflineAccess: () => notImplemented('GoogleUser.grantOfflineAccess'),
            disconnect: () => authInstance.disconnect(),
        }
    }

    function createBasicProfileMock() {
        return {
            getId: () => _user.id,
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
                if (_discoveryDocs[k]) {
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
