import React, { useState, useRef, useEffect } from 'react';
import './homepage.css';
import DeviceList from './DeviceList.jsx';
import { useSocket } from './SocketContext.jsx';

function generateFileId(file) {
  // Simple unique id: name + size + lastModified
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const CHUNK_SIZE = 64 * 1024; // 64KB

const HomePage = ({ username }) => {
  const { devices, socket, receivedFiles, isReconnecting } = useSocket();
  const [uploadQueue, setUploadQueue] = useState([]); // [{file, progress, status, fileId}]
  const fileInputRef = useRef();

  // Handle file selection and enqueue
  const handleSendFiles = (e) => {
    const files = Array.from(e.target.files);
    const newQueue = files.map(file => ({
      file,
      fileId: generateFileId(file),
      progress: 0,
      status: 'waiting', // 'waiting', 'uploading', 'done', 'cancelled'
    }));
    setUploadQueue(q => [...q, ...newQueue]);
  };

  // Upload next file in queue
  useEffect(() => {
    if (!socket || uploadQueue.length === 0) return;
    const uploadingIndex = uploadQueue.findIndex(f => f.status === 'uploading');
    if (uploadingIndex !== -1) return; // Already uploading
    const nextIndex = uploadQueue.findIndex(f => f.status === 'waiting');
    if (nextIndex === -1) return; // Nothing to upload
    uploadFileAtIndex(nextIndex);
    // eslint-disable-next-line
  }, [uploadQueue, socket]);

  // Upload logic for a single file
  const uploadFileAtIndex = async (idx) => {
    setUploadQueue(q => q.map((f, i) => i === idx ? { ...f, status: 'uploading' } : f));
    const { file, fileId } = uploadQueue[idx];
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploaded = 0;
    for (let i = 0; i < totalChunks; i++) {
      // If cancelled, stop
      if (uploadQueue[idx]?.status === 'cancelled') return;
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);
      const chunkBuffer = await chunk.arrayBuffer();
      socket?.emit('file-chunk', {
        fileId,
        fileName: file.name,
        index: i,
        totalChunks,
        size: file.size,
        chunk: Array.from(new Uint8Array(chunkBuffer)),
      });
      uploaded = end;
      const percent = Math.round((uploaded / file.size) * 100);
      setUploadQueue(q => q.map((f, j) => j === idx ? { ...f, progress: percent } : f));
      socket?.emit('upload-progress', {
        fileId,
        percent,
      });
    }
    setUploadQueue(q => q.map((f, j) => j === idx ? { ...f, status: 'done', progress: 100 } : f));
  };

  // Cancel a file in the queue
  const handleCancel = (idx) => {
    setUploadQueue(q => q.map((f, i) => i === idx ? { ...f, status: 'cancelled' } : f));
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="homepage-container">
      {isReconnecting && (
        <div className="neon-reconnect-banner">Reconnecting...</div>
      )}
      <div className="homepage-animated-left-bg" />
      <div className="homepage-content">
        <header className="homepage-header">
          <h1>Welcome, <span className="username">{username}</span></h1>
        </header>
        <div className="left-panel">
          <section className="devices-section">
            <h2>Connected Devices</h2>
            <DeviceList devices={devices} />
          </section>
        </div>
        <div className="right-panel">
          <section className="send-section">
            <h2>Send Files</h2>
            <button className="send-btn" onClick={handleOpenFilePicker}>Send Files</button>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleSendFiles}
            />
            <div className="file-upload-list">
              {uploadQueue.map((item, idx) => (
                <div key={item.fileId} className="file-upload-item">
                  <span>{item.file.name}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-inner"
                      style={{ width: `${item.progress || 0}%` }}
                    ></div>
                  </div>
                  <span className="progress-label">
                    {item.status === 'waiting' && 'Waiting...'}
                    {item.status === 'uploading' && `${item.progress}%`}
                    {item.status === 'done' && '100%'}
                    {item.status === 'cancelled' && 'Cancelled'}
                  </span>
                  {item.status !== 'done' && item.status !== 'cancelled' && (
                    <button
                      className="download-btn"
                      style={{ background: '#ff0055', color: '#fff', marginLeft: 8, fontSize: '0.9em', padding: '0.3rem 0.7rem' }}
                      onClick={() => handleCancel(idx)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="receive-section">
            <h2>Receive Files</h2>
            <div className="incoming-file-list">
              {receivedFiles.length === 0 && (
                <div style={{ color: '#aaa', textAlign: 'center', padding: '1rem' }}>No files received yet.</div>
              )}
              {receivedFiles.map((file) => (
                <div key={file.fileId} className="incoming-file-item">
                  <span>
                    <b>{file.fileName}</b>
                    {file.sender && (
                      <span style={{ color: '#00fff7', marginLeft: 8, fontSize: '0.95em' }}>
                        Received from {file.sender}
                      </span>
                    )}
                  </span>
                  {file.isImage ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      <img src={file.url} alt={file.fileName} style={{ maxHeight: 60, maxWidth: 80, borderRadius: 6, margin: '0 1rem' }} />
                    </a>
                  ) : null}
                  <a
                    href={file.url}
                    download={file.fileName}
                    className="download-btn"
                    style={{ marginLeft: file.isImage ? 0 : 'auto' }}
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 