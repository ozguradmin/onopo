export async function sendEmail({ to, subject, html }: { to: string, subject: string, html: string }) {
    try {
        const sendRequest = new Request('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [
                    {
                        to: [{ email: to, name: 'Customer' }],
                    },
                ],
                from: {
                    email: 'no-reply@onopo123.pages.dev', // Default sender
                    name: 'Onopo Store',
                },
                subject: subject,
                content: [
                    {
                        type: 'text/html',
                        value: html,
                    },
                ],
            }),
        })

        const response = await fetch(sendRequest)

        if (!response.ok) {
            const text = await response.text()
            console.error('MailChannels Error:', text)
            return false
        }

        return true
    } catch (e) {
        console.error('Email send failed', e)
        return false
    }
}
