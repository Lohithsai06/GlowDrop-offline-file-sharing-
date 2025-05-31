const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalExternalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const connectedDevices = new Map();
const fileTransfers = new Map();
const openStreams = new Map(); // { socketId: { [fileId]: writeStream } }
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.get('/', (req, res) => {
  res.send('Backend Running');
});

app.get('/devices', (req, res) => {
  const devices = Array.from(connectedDevices.values()).map(({ socketId, deviceType, ip, timeConnected, nickname }) => ({
    socketId, deviceType, ip, timeConnected, nickname
  }));
  res.json(devices);
});

function emitDeviceList() {
  const devices = Array.from(connectedDevices.values()).map(({ socketId, deviceType, ip, timeConnected, nickname }) => ({
    socketId, deviceType, ip, timeConnected, nickname
  }));
  io.emit('device-list', devices);
}

function logSocketEvents(socket) {
  const originalOn = socket.on;
  socket.on = function(event, listener) {
    originalOn.call(socket, event, function(...args) {
      if (event !== 'disconnect') { // 'disconnect' is handled separately
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Socket event: '${event}' from ${socket.id}`);
        if (args.length > 0) {
          console.log('  Payload:', JSON.stringify(args[0]));
        }
      }
      listener.apply(this, args);
    });
  };
}

io.on('connection', (socket) => {
  logSocketEvents(socket);
  const userAgent = socket.handshake.headers['user-agent'] || '';
  let deviceType = 'Desktop';
  if (/android/i.test(userAgent)) deviceType = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) deviceType = 'iOS';

  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
  const timeConnected = new Date().toISOString();

  connectedDevices.set(socket.id, {
    socketId: socket.id,
    deviceType,
    ip,
    timeConnected,
    nickname: '' // Default to empty string
  });

  console.log(`Client connected: ${socket.id}`);
  console.log(`  Device: ${deviceType}`);
  console.log(`  IP: ${ip}`);
  console.log(`  Time: ${timeConnected}`);

  emitDeviceList();

  socket.on('disconnect', () => {
    const device = connectedDevices.get(socket.id);
    if (device) {
      console.log(`Client disconnected: ${socket.id}`);
      console.log(`  Device: ${device.deviceType}`);
      console.log(`  IP: ${device.ip}`);
      console.log(`  Time connected: ${device.timeConnected}`);
      connectedDevices.delete(socket.id);
      emitDeviceList();
    }
    // Clean up open streams for this socket
    if (openStreams.has(socket.id)) {
      const streams = openStreams.get(socket.id);
      Object.values(streams).forEach((ws) => ws.end());
      openStreams.delete(socket.id);
    }
  });

  socket.on('send-file', ({ file, fileName }) => {
    socket.broadcast.emit('receive-file', { file, fileName });
  });

  socket.on('set-nickname', (nickname) => {
    const device = connectedDevices.get(socket.id);
    if (device) {
      device.nickname = nickname;
      emitDeviceList();
    }
  });

  socket.on('ping-device', () => {
    socket.emit('pong-device', { serverTime: new Date().toISOString(), status: 'ok' });
  });

  // --- Resumable Chunked Upload Logic ---
  socket.on('file-chunk', async ({ chunk, index, totalChunks, fileName, fileId }) => {
    try {
      if (!openStreams.has(socket.id)) openStreams.set(socket.id, {});
      const userStreams = openStreams.get(socket.id);
      const filePath = path.join(UPLOAD_DIR, fileId + path.extname(fileName));
      // Optional: Resume support - check if file exists and how many bytes are written
      // For simplicity, we assume chunks are written in order and not repeated
      if (index === 0) {
        // If file exists, delete for new upload
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        userStreams[fileId] = fs.createWriteStream(filePath, { flags: 'a' });
      }
      // Write chunk
      const buffer = Buffer.from(chunk);
      await new Promise((resolve, reject) => {
        userStreams[fileId].write(buffer, (err) => (err ? reject(err) : resolve()));
      });
      // Emit progress
      const percent = Math.round(((index + 1) / totalChunks) * 100);
      socket.emit('upload-progress', { fileId, percent });
      socket.broadcast.emit('receive-chunk', { chunk, index, totalChunks, fileName, fileId });
      if (index === totalChunks - 1) {
        userStreams[fileId].end();
        delete userStreams[fileId];
        socket.broadcast.emit('file-complete', { fileId, fileName });
      }
    } catch (err) {
      console.error('Error handling file chunk:', err);
      socket.emit('upload-error', { fileId, error: err.message });
    }
  });

  socket.on('upload-progress', ({ fileId, percent, senderId }) => {
    socket.broadcast.emit('receive-progress', { fileId, percent, senderId });
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  const lanIP = getLocalExternalIP();
  console.log(`Server listening on:`);
  console.log(`  Local: http://localhost:${PORT}`);
  console.log(`  LAN:   http://${lanIP}:${PORT}`);
}); 