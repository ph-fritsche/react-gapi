import { createContext } from 'react'

export const GoogleApiContext = createContext<GoogleApiContext>({ gapi: undefined })

export interface GoogleApiContext {
    gapi: gapi | undefined,
    configure?: configure,
}

export interface configure {
    (options: configureOptions, setState: (k: string) => void): gapi | undefined,
}

export interface configureOptions {
    discoveryDocs?: string[],
    scopes?: string[],
    modules?: string[],
    requestScopes?: boolean,
}
