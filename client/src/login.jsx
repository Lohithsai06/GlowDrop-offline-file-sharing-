import React, { useRef, useEffect, useState } from 'react';
import './login.css';

const Login = ({ onJoin }) => {
  const inputRef = useRef(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <div className="login-neon-bg">
      <form className="login-neon-box slide-up" onSubmit={handleJoin}>
        <div className="neon-glow-avatar">
          <span role="img" aria-label="user" className="neon-user-icon">👤</span>
        </div>
        <h2 className="neon-title">Join Now</h2>
        <div className="neon-input-group">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter your username"
            className="neon-input"
            maxLength={20}
            autoComplete="off"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <button className="neon-join-btn" type="submit" disabled={!username.trim()}>JOIN</button>
      </form>
    </div>
  );
};

export default Login; 