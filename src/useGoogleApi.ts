import { useContext, useEffect, useRef, useState } from 'react'
import { gapiObject } from './gapi'
import { configureOptions, GoogleApiContext } from './GoogleApiContext'

export function useGoogleApi(options: configureOptions = {}): gapiObject | undefined {
    const { gapi, configure } = useContext(GoogleApiContext) ?? {}

    const [configureState, setConfigureState] = useState<string>()

    const mounted = useRef<boolean>(true)
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

    return configure
        ? configure(
            options,
            newState => mounted.current && newState !== configureState && setConfigureState(newState),
        )
        : undefined
}
