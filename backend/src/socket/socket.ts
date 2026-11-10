import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { corsOrigin } from '../config/env';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: corsOrigin(),
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket Client Connected: ${socket.id}`);

    // Join session room
    socket.on('joinSession', (sessionId: string) => {
      if (sessionId) {
        socket.join(`session:${sessionId}`);
        console.log(`Socket client ${socket.id} joined room session:${sessionId}`);
      }
    });

    socket.on('leaveSession', (sessionId: string) => {
      if (sessionId) {
        socket.leave(`session:${sessionId}`);
        console.log(`Socket client ${socket.id} left room session:${sessionId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket Client Disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const ioEmitter = {
  emitSessionStarted: (sessionId: string, sessionData: any) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('sessionStarted', sessionData);
    }
  },

  emitStudentScanned: (sessionId: string, scanData: any) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('studentScanned', scanData);
    }
  },

  emitStatsUpdated: (sessionId: string, statsData: any) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('statisticsUpdated', statsData);
    }
  },

  emitMovementUpdated: (sessionId: string, movementData: any) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('movementUpdated', movementData);
    }
  },

  emitSessionEnding: (sessionId: string) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('sessionEnding');
    }
  },

  emitSessionCompleted: (sessionId: string, sessionData: any) => {
    if (io) {
      io.to(`session:${sessionId}`).emit('sessionCompleted', sessionData);
    }
  },

  emitTimetableUpdated: () => {
    if (io) {
      io.emit('timetableUpdated');
    }
  }
};
