import * as CryptoJS from 'crypto-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const elliptic = require('elliptic');
const { ec: EC } = elliptic;
const { authenticator } = require('otplib');

const ec = new EC('p256');

export class CryptoService {
    /**
     * Verify RFC 6238 TOTP
     * Validates that the provided OTP matches the secret within the allowed drift window
     */
    static verifyTOTP(otp: string, secret: string): boolean {
        try {
            const counter = Math.floor(Date.now() / 30000);

            // Check window of ±1 (standard TOTP grace period)
            for (let i = -1; i <= 1; i++) {
                const checkCounter = counter + i;
                const counterHex = checkCounter.toString(16).padStart(16, '0');

                const hmac = CryptoJS.HmacSHA256(
                    CryptoJS.enc.Hex.parse(counterHex),
                    CryptoJS.enc.Hex.parse(secret)
                );

                const hmacHex = hmac.toString(CryptoJS.enc.Hex);
                const offset = parseInt(hmacHex.substring(hmacHex.length - 1), 16);
                const truncatedHash = parseInt(hmacHex.substring(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
                const computedOtp = (truncatedHash % 1000000).toString().padStart(6, '0');

                if (computedOtp === otp) return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Verify ECDSA Signature (secp256r1)
     * Ensuring the payload was signed by the user's specific device
     */
    static verifySignature(payload: string, signatureDer: string, publicKeyHex: string): boolean {
        try {
            const key = ec.keyFromPublic(publicKeyHex, 'hex');
            const hash = CryptoJS.SHA256(payload).toString();
            return key.verify(hash, signatureDer);
        } catch (e) {
            return false;
        }
    }

    /**
     * Verify Hash Chain Integrity
     * Recomputes the current hash based on previous state and current payload
     */
    static verifyHashChain(prevHash: string, payloadStr: string, currentHash: string): boolean {
        const computedHash = CryptoJS.SHA256(prevHash + payloadStr).toString();
        return computedHash === currentHash;
    }

    /**
     * Generate a unique audit hash for a batch of transactions
     */
    static generateBatchHash(txs: any[]): string {
        return CryptoJS.SHA256(JSON.stringify(txs)).toString();
    }
}
