import React from 'react';
import './deviceList.css';

// device: { id, name, ip, nickname (optional), status ("online"/"offline") }
const DeviceList = ({ devices }) => {
  return (
    <div className="device-list-cards">
      {devices.map(device => (
        <div className="device-card" key={device.id}>
          <div className="device-avatar">
            <span role="img" aria-label="device">💻</span>
          </div>
          <div className="device-info">
            <div className="device-name-row">
              <span className="device-name">{device.name}</span>
              {device.nickname && <span className="device-nickname">({device.nickname})</span>}
            </div>
            <span className="device-ip">{device.ip}</span>
          </div>
          <span className={`device-status ${device.status === 'online' ? 'online' : 'offline'}`}></span>
        </div>
      ))}
    </div>
  );
};

export default DeviceList; 