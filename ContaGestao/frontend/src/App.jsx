import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('apiKey')));

  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    setIsAuthenticated(false);
  };

  return (
    <div>
      {!isAuthenticated ? (
        <Login onLoginSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;