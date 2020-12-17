import { waitFor } from '@testing-library/react'
import { createGapiMock } from '../src/gapiMock'

function loadAndInitAuth2(gapi, initConf) {
    return new Promise((res, rej) => {
        gapi.load('auth2', () => {
            gapi.auth2.init(initConf).then(
                auth => {
                    const signedInListener = jest.fn()
                    auth.isSignedIn.listen(signedInListener)
                    const currentUserListener = jest.fn()
                    auth.currentUser.listen(currentUserListener)

                    res({auth, signedInListener, currentUserListener})
                },
                rej,
            )
        })
    })
}

const johnDoe = {
    name: 'John Doe',
    givenName: 'John',
    familyName: 'Doe',
    email: 'john.doe@example.com',
    imageUrl: 'https://example.com/john-doe.png',
}

it('Load auth2 module', async () => {
    const { gapi } = createGapiMock()

    expect(gapi.auth2).toBe(undefined)

    const init = jest.fn()

    gapi.load('auth2', init)

    await waitFor(() => expect(init).toBeCalled())

    expect(gapi.auth2.init).toBeType('function')
})

it('Init with signedIn user (fetch_basic_profile=false)', async () => {
    const { gapi, user } = createGapiMock()

    user.isSignedIn(['bar', 'baz'], johnDoe)

    const { auth } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
        fetch_basic_profile: false,
        scope: 'bar baz',
    })

    expect(auth).toBe(gapi.auth2.getAuthInstance())
    expect(auth.isSignedIn.get()).toBeTruthy()
    expect(auth.currentUser.get().getGrantedScopes()).toBe('bar baz')

    expect(auth.currentUser.get().getBasicProfile().getName()).toBe('')
})

it('Init with signedIn user (fetch_basic_profile=true)', async () => {
    const { gapi, user } = createGapiMock()

    user.isSignedIn([], johnDoe)

    const { auth } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
    })

    expect(auth).toBe(gapi.auth2.getAuthInstance())
    expect(auth.isSignedIn.get()).toBe(true)

    expect(auth.currentUser.get().getGrantedScopes()).toMatch(/(^| )email( |$)/)
    expect(auth.currentUser.get().getGrantedScopes()).toMatch(/(^| )openid( |$)/)
    expect(auth.currentUser.get().getGrantedScopes()).toMatch(/(^| )profile( |$)/)

    expect(auth.currentUser.get().getBasicProfile().getName()).toBe('John Doe')
    expect(auth.currentUser.get().getBasicProfile().getGivenName()).toBe('John')
    expect(auth.currentUser.get().getBasicProfile().getFamilyName()).toBe('Doe')
    expect(auth.currentUser.get().getBasicProfile().getEmail()).toBe('john.doe@example.com')
    expect(auth.currentUser.get().getBasicProfile().getImageUrl()).toBe('https://example.com/john-doe.png')
})

it('Sign in', async () => {
    const { gapi, user } = createGapiMock()

    const { auth, signedInListener, currentUserListener } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
        fetch_basic_profile: false,
        scope: 'bar baz',
    })
    expect(auth).toBe(gapi.auth2.getAuthInstance())
    expect(auth.currentUser.get()).toBe(undefined)

    const signIn = gapi.auth2.getAuthInstance().signIn()

    user.grantsScopes(true)

    const currentUser = await signIn
    expect(currentUser).toBe(gapi.auth2.getAuthInstance().currentUser.get())
    expect(currentUser.getGrantedScopes()).toMatch(/(^| )bar( |$)/)
    expect(currentUser.getGrantedScopes()).toMatch(/(^| )baz( |$)/)

    expect(signedInListener).toBeCalledWith(true)
    expect(currentUserListener).toBeCalledWith(currentUser)
})

it('Set basic profile infos per user.grantsScopes', async () => {
    const { gapi, user } = createGapiMock()

    const { auth } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
    })
    const signIn = gapi.auth2.getAuthInstance().signIn()

    user.grantsScopes(true, johnDoe)

    await signIn

    expect(auth.currentUser.get().getBasicProfile().getName()).toBe('John Doe')
    expect(auth.currentUser.get().getBasicProfile().getGivenName()).toBe('John')
    expect(auth.currentUser.get().getBasicProfile().getFamilyName()).toBe('Doe')
    expect(auth.currentUser.get().getBasicProfile().getEmail()).toBe('john.doe@example.com')
    expect(auth.currentUser.get().getBasicProfile().getImageUrl()).toBe('https://example.com/john-doe.png')
})

it('Sign in with some of the scopes', async () => {
    const { gapi, user } = createGapiMock()

    const { auth } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
        fetch_basic_profile: false,
        scope: 'bar baz',
    })
    expect(auth).toBe(gapi.auth2.getAuthInstance())
    expect(auth.currentUser.get()).toBe(undefined)

    const signIn = gapi.auth2.getAuthInstance().signIn()

    user.grantsScopes(['baz'])

    const currentUser = await signIn
    expect(currentUser).toBe(gapi.auth2.getAuthInstance().currentUser.get())
    expect(currentUser.getGrantedScopes()).not.toMatch(/(^| )bar( |$)/)
    expect(currentUser.getGrantedScopes()).toMatch(/(^| )baz( |$)/)
})

it('Grant additional scopes', async () => {
    const { gapi, user } = createGapiMock()

    user.isSignedIn()

    const { auth, signedInListener, currentUserListener } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
    })

    const grantRequest = auth.currentUser.get().grant('bar baz')

    user.grantsScopes(['baz'])

    const currentUser = await grantRequest
    expect(currentUser.getGrantedScopes()).not.toMatch(/(^| )bar( |$)/)
    expect(currentUser.getGrantedScopes()).toMatch(/(^| )baz( |$)/)

    expect(signedInListener).not.toBeCalled()
    expect(currentUserListener).toBeCalledWith(currentUser)
})

it('Sign out', async () => {
    const { gapi, user } = createGapiMock()

    user.isSignedIn()

    const { auth, signedInListener, currentUserListener } = await loadAndInitAuth2(gapi, {
        client_id: 'foo',
    })

    await auth.signOut()

    expect(auth.isSignedIn.get()).toBe(false)

    expect(signedInListener).toBeCalledWith(false)
    expect(currentUserListener).toBeCalledWith(auth.currentUser.get())
})
