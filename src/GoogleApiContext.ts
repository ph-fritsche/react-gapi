import { createContext } from 'react'
import { gapiObject } from './gapi'

export const GoogleApiContext = createContext<GoogleApiContext>({ gapi: undefined })

export interface GoogleApiContext {
    gapi: gapiObject | undefined,
    configure?: configure,
}

export interface configure {
    (options: configureOptions, setState: (k: string) => void): gapiObject | undefined,
}

export interface configureOptions {
    discoveryDocs?: string[],
    scopes?: string[],
    modules?: string[],
    requestScopes?: boolean,
}
