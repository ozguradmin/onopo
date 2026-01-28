import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json()

        // This is a placeholder for Cloudflare Email / MailChannels integration
        // In a real environment, you would use fetch to MailChannels or SendGrid here

        console.log(`FORGOT PASSWORD REQUEST FOR: ${email}`)

        /* 
        Example MailChannels fetch for Cloudflare Workers:
        await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: 'ozgurglr256@gmail.com' }] }],
                from: { email: 'no-reply@onopo.com', name: 'Onopo Admin' },
                subject: 'Admin Şifre Sıfırlama',
                content: [{
                    type: 'text/plain',
                    value: 'Admin şifrenizi sıfırlamak için bu bağlantıyı kullanın: [Link Burada]'
                }]
            })
        })
        */

        return NextResponse.json({ success: true, message: 'Mail sent to ozgurglr256@gmail.com' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
