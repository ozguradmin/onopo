import { Resend } from 'resend'

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789')

const FROM_EMAIL = 'Onopo Store <no-reply@onopostore.com>'

// Email templates
export const emailTemplates = {
    orderConfirmation: (order: any, items: any[]) => ({
        subject: `Sipariş Onayı - #${order.id}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Siparişiniz Alındı! 🎉</h1>
                </div>
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
                <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; margin: 0; font-size: 14px;">
                        Onopo Store | onopostore.com
                    </p>
                </div>
            </div>
        `
    }),

    trackingUpdate: (order: any, trackingNumber: string) => ({
        subject: `Kargonuz Yola Çıktı! - #${order.id}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #8b5cf6, #a855f7); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Kargonuz Yola Çıktı! 📦</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                    <p style="font-size: 16px; color: #334155;">
                        <strong>#${order.id}</strong> numaralı siparişiniz kargoya verildi.
                    </p>
                    
                    <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <h3 style="margin-top: 0; color: #1e293b;">Kargo Takip Numarası</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #8b5cf6; margin: 10px 0;">${trackingNumber}</p>
                        <p style="color: #64748b; font-size: 14px;">
                            Bu numara ile kargo firmasının web sitesinden takip yapabilirsiniz.
                        </p>
                    </div>
                </div>
                <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; margin: 0; font-size: 14px;">
                        Onopo Store | onopostore.com
                    </p>
                </div>
            </div>
        `
    }),

    welcome: (email: string) => ({
        subject: 'Onopo Store\'a Hoş Geldiniz! 🎊',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981, #14b8a6); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Hoş Geldiniz! 🎊</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                    <p style="font-size: 16px; color: #334155;">Merhaba,</p>
                    <p style="font-size: 16px; color: #334155;">
                        <strong>Onopo Store</strong> ailesine katıldığınız için teşekkür ederiz!
                    </p>
                    <p style="font-size: 16px; color: #334155;">
                        Kayıt işleminiz başarıyla tamamlandı. Artık alışverişe başlayabilirsiniz.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://onopostore.com/products" 
                           style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Alışverişe Başla
                        </a>
                    </div>
                </div>
                <div style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="color: #94a3b8; margin: 0; font-size: 14px;">
                        Onopo Store | onopostore.com
                    </p>
                </div>
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

// Get Resend instance for direct use
export { resend }
