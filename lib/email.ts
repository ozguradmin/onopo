import { Resend } from 'resend'

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789')

const FROM_EMAIL = 'Onopo Store <no-reply@onopostore.com>'
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'
const LOGO_URL = `${SITE_URL}/logo.png`

// Common email header with logo
const emailHeader = (title: string, emoji: string = '📦') => `
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center;">
        <a href="${SITE_URL}" style="text-decoration: none;">
            <img src="${LOGO_URL}" alt="Onopo Store" style="height: 40px; margin-bottom: 15px;" />
        </a>
        <h1 style="color: white; margin: 0;">${title} ${emoji}</h1>
    </div>
`

// Common email footer with logo
const emailFooter = () => `
    <div style="background: #1e293b; padding: 20px; text-align: center;">
        <a href="${SITE_URL}" style="text-decoration: none;">
            <img src="${LOGO_URL}" alt="Onopo Store" style="height: 30px; margin-bottom: 10px; filter: brightness(0) invert(1);" />
        </a>
        <p style="color: #94a3b8; margin: 0; font-size: 14px;">
            <a href="${SITE_URL}" style="color: #94a3b8; text-decoration: none;">onopostore.com</a>
        </p>
    </div>
`

// Email templates
export const emailTemplates = {
    orderConfirmation: (order: any, items: any[]) => ({
        subject: `Sipariş Onayı - #${order.id}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${emailHeader('Siparişiniz Alındı!', '🎉')}
                <div style="padding: 30px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                    <p style="font-size: 16px; color: #334155;">
                        <strong>#${order.id}</strong> numaralı siparişiniz başarıyla oluşturuldu.
                    </p>
                    
                    <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; color: #1e293b;">Sipariş Detayları</h3>
                        ${items.map(item => `
                            <div style="display: flex; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <div style="flex: 1;">
                                    <p style="margin: 0; font-weight: 600; color: #1e293b;">${item.name}</p>
                                    <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Adet: ${item.quantity}</p>
                                </div>
                                <p style="margin: 0; font-weight: 600; color: #1e293b;">${(item.price * item.quantity).toFixed(2)} ₺</p>
                            </div>
                        `).join('')}
                        <div style="padding-top: 15px; text-align: right;">
                            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">
                                Toplam: ${order.total_amount?.toFixed(2) || order.total?.toFixed(2)} ₺
                            </p>
                        </div>
                    </div>
                    
                    <p style="font-size: 14px; color: #64748b;">
                        Siparişinizin durumunu takip etmek için size bilgilendirme e-postaları göndereceğiz.
                    </p>
                </div>
                ${emailFooter()}
            </div>
        `
    }),

    trackingUpdate: (order: any, trackingNumber: string) => ({
        subject: `Kargonuz Yola Çıktı! - #${order.id}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${emailHeader('Kargonuz Yola Çıktı!', '📦')}
                <div style="padding: 30px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                    <p style="font-size: 16px; color: #334155;">
                        <strong>#${order.id}</strong> numaralı siparişiniz kargoya verildi.
                    </p>
                    
                    <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <h3 style="margin-top: 0; color: #1e293b;">Kargo Takip Numarası</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #8b5cf6; margin: 10px 0;">${trackingNumber}</p>
                        <p style="margin: 15px 0;">
                            <a href="https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${trackingNumber}" 
                               style="background: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                                Aras Kargo Takip
                            </a>
                        </p>
                        <p style="color: #64748b; font-size: 14px;">
                            Yukarıdaki butona tıklayarak kargonuzu takip edebilirsiniz.
                        </p>
                    </div>
                </div>
                ${emailFooter()}
            </div>
        `
    }),

    welcome: (email: string) => ({
        subject: 'Onopo Store\'a Hoş Geldiniz! 🎊',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${emailHeader('Hoş Geldiniz!', '🎊')}
                <div style="padding: 30px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                    <p style="font-size: 16px; color: #334155;">
                        <strong>Onopo Store</strong> ailesine katıldığınız için teşekkür ederiz!
                    </p>
                    <p style="font-size: 16px; color: #334155;">
                        Kayıt işleminiz başarıyla tamamlandı. Artık alışverişe başlayabilirsiniz.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${SITE_URL}/products" 
                           style="background: #6366f1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Alışverişe Başla
                        </a>
                    </div>
                </div>
                ${emailFooter()}
            </div>
        `
    }),

    adminNewOrder: (order: any, items: any[], customerEmail: string) => ({
        subject: `🔔 Yeni Sipariş! #${order.id} - ${order.total_amount?.toFixed(2) || order.total?.toFixed(2)} ₺`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Yeni Sipariş Geldi! 🔔</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; color: #1e293b;">Sipariş #${order.id}</h3>
                        <p style="margin: 5px 0; color: #64748b;"><strong>Müşteri:</strong> ${customerEmail}</p>
                        <p style="margin: 5px 0; color: #64748b;"><strong>Toplam:</strong> ${order.total_amount?.toFixed(2) || order.total?.toFixed(2)} ₺</p>
                    </div>
                    
                    <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                        <h4 style="margin-top: 0; color: #1e293b;">Ürünler</h4>
                        ${items.map(item => `
                            <div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #1e293b;">${item.name}</span>
                                <span style="color: #64748b;"> x${item.quantity}</span>
                                <span style="float: right; color: #1e293b; font-weight: 600;">${(item.price * item.quantity).toFixed(2)} ₺</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="https://onopostore.com/admin/orders/${order.id}" 
                           style="background: #f59e0b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Siparişi Görüntüle
                        </a>
                    </div>
                </div>
            </div>
        `
    })
}

// Send email functions
export async function sendOrderConfirmation(order: any, items: any[], toEmail: string) {
    try {
        const template = emailTemplates.orderConfirmation(order, items)
        await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: template.subject,
            html: template.html
        })
        console.log('Order confirmation email sent to:', toEmail)
        return { success: true }
    } catch (error) {
        console.error('Failed to send order confirmation:', error)
        return { success: false, error }
    }
}

export async function sendTrackingUpdate(order: any, trackingNumber: string, toEmail: string) {
    try {
        const template = emailTemplates.trackingUpdate(order, trackingNumber)
        await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: template.subject,
            html: template.html
        })
        console.log('Tracking update email sent to:', toEmail)
        return { success: true }
    } catch (error) {
        console.error('Failed to send tracking update:', error)
        return { success: false, error }
    }
}

export async function sendWelcomeEmail(toEmail: string) {
    try {
        const template = emailTemplates.welcome(toEmail)
        await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: template.subject,
            html: template.html
        })
        console.log('Welcome email sent to:', toEmail)
        return { success: true }
    } catch (error) {
        console.error('Failed to send welcome email:', error)
        return { success: false, error }
    }
}

export async function sendAdminNewOrderNotification(order: any, items: any[], customerEmail: string, adminEmail: string) {
    try {
        const template = emailTemplates.adminNewOrder(order, items, customerEmail)
        await resend.emails.send({
            from: FROM_EMAIL,
            to: adminEmail,
            subject: template.subject,
            html: template.html
        })
        console.log('Admin notification email sent to:', adminEmail)
        return { success: true }
    } catch (error) {
        console.error('Failed to send admin notification:', error)
        return { success: false, error }
    }
}

export async function sendCustomEmail(to: string | string[], subject: string, htmlContent: string) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: Array.isArray(to) ? to : [to],
            subject,
            html: htmlContent
        })
        console.log('Custom email sent to:', to)
        return { success: true }
    } catch (error) {
        console.error('Failed to send custom email:', error)
        return { success: false, error }
    }
}

// 2FA Email Template
export const twoFactorTemplate = (code: string) => ({
    subject: '🔐 Giriş Doğrulama Kodu - Onopo Store',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Giriş Doğrulama 🔐</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
                <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                <p style="font-size: 16px; color: #334155;">
                    Onopo Store yönetim paneline giriş yapmak için doğrulama kodunuz:
                </p>
                
                <div style="background: white; border-radius: 12px; padding: 30px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                    <p style="font-size: 48px; font-weight: bold; color: #6366f1; margin: 0; letter-spacing: 8px;">
                        ${code}
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #64748b; text-align: center;">
                    ⏰ Bu kod <strong>60 saniye</strong> içinde geçerliliğini yitirecektir.
                </p>
                
                <p style="font-size: 14px; color: #94a3b8; margin-top: 30px;">
                    Bu giriş denemesini siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.
                </p>
            </div>
            <div style="background: #1e293b; padding: 20px; text-align: center;">
                <p style="color: #94a3b8; margin: 0; font-size: 14px;">
                    Onopo Store Güvenlik
                </p>
            </div>
        </div>
    `
})

// Send 2FA verification code
export async function send2FACode(code: string, toEmail: string) {
    try {
        const template = twoFactorTemplate(code)
        await resend.emails.send({
            from: FROM_EMAIL,
            to: toEmail,
            subject: template.subject,
            html: template.html
        })
        console.log('2FA code email sent to:', toEmail)
        return { success: true }
    } catch (error) {
        console.error('Failed to send 2FA code:', error)
        return { success: false, error }
    }
}

// Get Resend instance for direct use
export { resend }
