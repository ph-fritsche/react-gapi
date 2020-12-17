import { useContext, useEffect, useRef, useState } from 'react'
import { GoogleApiContext } from './GoogleApiContext'

export function useGoogleApi({discoveryDocs = [], scopes = [], modules = []} = {}): gapi | undefined {
    const { gapi, configure } = useContext(GoogleApiContext) ?? {}

    const [configureState, setConfigureState] = useState<string>()

    const mounted = useRef<boolean>()
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false}
    })

    const [, rerender] = useState<unknown>()
    const auth = gapi?.auth2?.getAuthInstance()
    useEffect(() => {
        if (auth) {
            auth.isSignedIn.listen(() => mounted.current && rerender({}))
            auth.currentUser.listen(() => mounted.current && rerender({}))
        }
    }, [auth])

    return configure ? configure({discoveryDocs, scopes, modules}, newState => mounted.current && newState !== configureState && setConfigureState(newState)) : undefined
}
