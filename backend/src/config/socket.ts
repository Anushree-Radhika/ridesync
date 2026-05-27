import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
    io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Connected: ${socket.id}`);
        socket.on('disconnect', (reason) => {
            console.log(`❌ Disconnected: ${socket.id} — ${reason}`);
        });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};