import express from 'express';
import cors from 'cors';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '🚀 RideSync API running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});

// Phase 2 routes go here
// app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;