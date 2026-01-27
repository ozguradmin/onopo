import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-change-this')

// Edge-compatible password hashing using Web Crypto API
// Uses PBKDF2 instead of bcrypt for Edge Runtime compatibility
async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
    )

    return await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    )
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

function hexToUint8Array(hex: string): Uint8Array {
    const matches = hex.match(/.{2}/g)
    if (!matches) return new Uint8Array(0)
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)))
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const derivedKey = await deriveKey(password, salt)
    const saltHex = arrayBufferToHex(salt.buffer as ArrayBuffer)
    const hashHex = arrayBufferToHex(derivedKey)
    return `${saltHex}:${hashHex}`
}

export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
    try {
        const [saltHex, hashHex] = storedHash.split(':')
        if (!saltHex || !hashHex) return false

        const salt = hexToUint8Array(saltHex)
        const derivedKey = await deriveKey(password, salt)
        const newHashHex = arrayBufferToHex(derivedKey)

        return newHashHex === hashHex
    } catch {
        return false
    }
}

export async function signJWT(payload: any): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET_KEY)
}

export async function verifyJWT(token: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY)
        return payload
    } catch (error) {
        return null
    }
}
