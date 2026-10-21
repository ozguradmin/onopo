/**
 * Turkish text for the error messages the auth APIs return in English (the API responses stay as
 * they are; only what the visitor reads is translated). Unknown messages are shown unchanged.
 */
const MESSAGES: Record<string, string> = {
    'Invalid credentials': 'E-posta adresi veya şifre hatalı.',
    'Email and password are required': 'E-posta ve şifre zorunlu.',
    'User already exists': 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı dene.',
    'Internal Server Error': 'Bir sorun oluştu. Lütfen biraz sonra tekrar dene.',
    'Failed to fetch': 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
    'Load failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
    'NetworkError when attempting to fetch resource.': 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
}

export function authErrorText(message: string): string {
    if (Object.prototype.hasOwnProperty.call(MESSAGES, message)) return MESSAGES[message]
    // A non-JSON answer (e.g. an HTML error page) makes res.json() throw a SyntaxError
    if (/JSON|Unexpected token|is not valid/i.test(message)) return MESSAGES['Internal Server Error']
    return message
}
