import './App.css'
import React, { useState } from 'react';
import Login from './login.jsx';
import HomePage from './HomePage.jsx';
import { SocketProvider } from './SocketContext.jsx';

function App() {
  const [username, setUsername] = useState('');

  return (
    <SocketProvider username={username}>
      {username
        ? <HomePage username={username} />
        : <Login onJoin={setUsername} />}
    </SocketProvider>
  );
}

export default App;
