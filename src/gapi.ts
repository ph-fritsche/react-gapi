export interface gapiObject {
    load: typeof gapi.load,
    client?: client,
    auth2?: auth2,
    [k: string]: unknown,
}

interface client {
    init: typeof gapi.client.init,
    [k: string]: unknown,
}

export type ClientConfig = Parameters<typeof gapi.client.init>[0]

interface auth2 {
    init: typeof gapi.auth2.init,
    getAuthInstance: typeof gapi.auth2.getAuthInstance,
    authorize: typeof gapi.auth2.authorize,
    [k: string]: unknown,
}

export interface gapiError {
    error: string,
    error_subtype?: string,
    details?: string,
    [k: string]: unknown,
}
