import React from 'react'
import { useGoogleApi } from '../../src'

export function MyAuthComponent() {
    const gapi = useGoogleApi({
        scopes: [
            'profile',
        ],
    })

    const auth = gapi?.auth2.getAuthInstance()

    return <div>{
        !auth
            ? <span>Loading...</span>
            : auth?.isSignedIn.get()
                ? `Logged in as "${auth.currentUser.get().getBasicProfile().getName()}"`
                : <button onClick={() => auth.signIn()}>Login</button>
    }</div>
}
