declare module 'react-weblibrary' {
    type status = 'try' | 'error' | 'load'

    export function useLibrary(name: string, url: string): [library: unknown, status: status, tryAgain: () => void];
}
