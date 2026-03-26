import createApp from './app.js';
import { env } from './config/env.config.js';

const start = async () => {
    const app = await createApp();
    try {
        const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
        app.log.info(`🚀 Server listening at ${address}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
