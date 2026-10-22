import { LoginClient } from './login-form'
import { redirectIfSignedIn } from './signed-in-redirect'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Signed-in visitors are sent on (?redirect= or their account) before any form is rendered.
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
    await redirectIfSignedIn(await searchParams)
    return <LoginClient />
}
