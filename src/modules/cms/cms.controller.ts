import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ApiResponse } from '../../types/index.js';

const cmsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    /**
     * Get CMS Content by Slug
     */
    fastify.get('/content/:slug', async (request, reply): Promise<ApiResponse> => {
        const { slug } = request.params as { slug: string };

        const content: Record<string, any> = {
            'help-center': {
                title: 'Help Center',
                sections: [
                    {
                        title: 'Getting Started',
                        items: [
                            { q: 'How do I fund my account?', a: 'You can fund your account by transferring to your unique account number visible on the dashboard.' },
                            { q: 'How do I pay merchants?', a: 'Tap the "Send" or "Main" QR icon on your dashboard to scan a merchant QR code.' }
                        ]
                    },
                    {
                        title: 'Security',
                        items: [
                            { q: 'Is my money safe offline?', a: 'Yes, offline funds are secured using hardware-level ECC keys and rotating HMAC signatures.' },
                            { q: 'What if I lose my phone?', a: 'Contact support immediately to freeze your account and revoke the device security keys.' }
                        ]
                    }
                ]
            },
            'terms': {
                title: 'Terms & Conditions',
                body: 'Welcome to QR Pay. By using our services, you agree to our terms of use which include maintaining the security of your device and following local financial regulations. We reserve the right to suspend accounts suspected of fraudulent activity...'
            },
            'privacy': {
                title: 'Privacy Policy',
                body: 'We value your privacy. Your biometric data never leaves your device and is stored in the Secure Enclave. Transaction data is encrypted and used only for financial reconciliation and fraud prevention...'
            }
        };

        const result = content[slug];
        if (!result) {
            return { success: false, message: 'Content not found' };
        }

        return {
            success: true,
            data: result
        };
    });
};

export default cmsRoutes;
