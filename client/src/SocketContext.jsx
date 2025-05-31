import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children, username }) => {
  const [devices, setDevices] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fileChunksRef = useRef({}); // { fileId: { chunks: [], meta: {} } }
  const socketRef = useRef();

  // Helper to register all listeners
  const registerListeners = (socket) => {
    socket.on('device-list', (deviceList) => {
      setDevices(deviceList);
    });
    socket.on('receive-chunk', (data) => {
      const { fileId, chunk, index, totalChunks, fileName, type, sender } = data;
      if (!fileChunksRef.current[fileId]) {
        fileChunksRef.current[fileId] = { chunks: [], meta: { fileName, totalChunks, type, sender } };
      }
      fileChunksRef.current[fileId].chunks[index] = new Uint8Array(chunk);
    });
    socket.on('receive-progress', () => {
      // Optionally update progress for a file
    });
    socket.on('file-complete', (data) => {
      const { fileId } = data;
      const fileData = fileChunksRef.current[fileId];
      if (fileData) {
        const { fileName, type, sender } = fileData.meta;
        const blob = new Blob(fileData.chunks, { type: type || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const isImage = type && type.startsWith('image/');
        setReceivedFiles((prev) => [
          ...prev,
          {
            fileId,
            fileName,
            sender,
            url,
            type,
            isImage,
            blob,
          },
        ]);
        delete fileChunksRef.current[fileId];
      }
    });
    socket.on('disconnect', () => {
      setIsReconnecting(true);
    });
    socket.on('reconnect', () => {
      setIsReconnecting(false);
      if (username) {
        socket.emit('set-nickname', username);
      }
    });
    socket.on('connect', () => {
      setIsReconnecting(false);
      if (username) {
        socket.emit('set-nickname', username);
      }
    });
    socket.io.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });
    socket.io.on('reconnect_failed', () => {
      setIsReconnecting(true);
    });
    socket.io.on('reconnect_error', () => {
      setIsReconnecting(true);
    });
  };

  useEffect(() => {
    // Connect to backend using LAN IP dynamically, with auto-reconnect
    socketRef.current = io(`http://${window.location.hostname}:5000`, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });
    registerListeners(socketRef.current);
    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (username && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('set-nickname', username);
    }
  }, [username]);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      devices,
      receivedFiles,
      setReceivedFiles,
      isReconnecting,
    }}>
      {children}
      {/* Optionally, you can show a global reconnecting banner here */}
    </SocketContext.Provider>
  );
}; 