import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL as string, {
    tls: {},
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));
redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));

export default redis;