export interface gapiObject {
    load: typeof gapi.load,
    client?: gapiObject.client,
    auth2?: gapiObject.auth2,
    [k: string]: unknown,
}

declare namespace gapiObject {
    interface client {
        init: typeof gapi.client.init,
        [k: string]: unknown,
    }

    namespace client {
        type ClientConfig = Parameters<typeof gapi.client.init>[0]
    }

    interface auth2 {
        init: typeof gapi.auth2.init,
        getAuthInstance: typeof gapi.auth2.getAuthInstance,
        authorize: typeof gapi.auth2.authorize,
        [k: string]: unknown,
    }
}

interface gapiError {
    error: string,
    error_subtype?: string,
    details?: string,
    [k: string]: unknown,
}
