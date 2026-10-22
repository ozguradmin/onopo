import { RegisterClient } from './register-form'
import { redirectIfSignedIn } from '../login/signed-in-redirect'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Signed-in visitors are sent on (?redirect= or their account) before any form is rendered.
export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
    await redirectIfSignedIn(await searchParams)
    return <RegisterClient />
}
