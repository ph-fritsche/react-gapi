# react-gapi

Provides the configured `gapi` library from https://apis.google.com/js/api.js per react hook.

```js
// src/App.js
import { GoogleApiProvider } from 'react-gapi'
import { MyDriveComponent } from './MyDriveComponent.js'

export function App() {
  return (
    <GoogleApiProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      // ...
      <MyAuthComponent/>
      // ...
      <MyDriveComponent/>
      // ...
    </GoogleApiProvider>
  )
}
```
```js
// src/MyAuthComponent.js
import { useGoogleApi } from 'react-gapi'

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
```
```js
// src/MyDriveComponent.js
import { useGoogleApi } from 'react-gapi'

export function MyDriveComponent() {
  const gapi = useGoogleApi({
    discoveryDocs: [
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    ],
    scopes: [
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  })

  if (!gapi) {
    return <div>Some loading screen</div>
  }

  // access the Drive API per gapi.client.drive
}
```

## Testing

```js
// src/MyAuthComponent.test.js
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { MyAuthComponent } from './MyAuthComponent'
import { GoogleApiProvider } from 'react-gapi'
import { createGapiMock } from 'react-gapi/testing'

it('Sign in', async () => {
    const { user } = createGapiMock()

    render(
        <GoogleApiProvider clientId="foo" >
            <MyAuthComponent />
        </GoogleApiProvider>,
    )

    userEvent.click(await screen.findByRole('button', { name: /login/i }))

    act(() => {
        user.grantsScopes?.(true, { name: 'John Doe' })
    })

    expect(await screen.findByText(/Logged in as /)).toHaveTextContent('"John Doe"')
})
```