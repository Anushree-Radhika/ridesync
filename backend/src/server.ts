import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './config/socket';
import prisma from './config/db';
import redis from './config/redis';

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log('✅ PostgreSQL connected');

        await redis.ping();
        console.log('✅ Redis ping OK');

        server.listen(PORT, () => {
            console.log(`🚀 RideSync running on port ${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/health`);
        });

    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
};

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await prisma.$disconnect();
    redis.disconnect();
    server.close(() => process.exit(0));
});

startServer();