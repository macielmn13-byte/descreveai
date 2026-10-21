import { useState } from 'react';
import { apiRequest } from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Vamos testar a chave batendo na rota de saúde (health) do backend
    try {
      await apiRequest('/documentos', { apiKey });
      localStorage.setItem('apiKey', apiKey);
      onLoginSuccess();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '10px', width: '320px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <img
          src="/logo-aguia.png"
          alt="Símbolo da ContaGestão: águia sobre um escudo com balança"
          style={{ width: '112px', height: '112px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '16px', padding: '4px', alignSelf: 'center' }}
        />
        <h2 style={{ textAlign: 'center', color: '#ff8c00', margin: 0 }}>ContaGestão</h2>
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#888' }}>Acesso do Gestor (API Key)</p>
        
        <input 
          type="password" 
          placeholder="Insira sua Chave de API" 
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#222', color: 'white' }}
        />
        
        {error && <p style={{ color: '#ff4444', fontSize: '12px', textAlign: 'center' }}>{error}</p>}

        <button type="submit" style={{ padding: '10px', backgroundColor: '#ff8c00', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' }}>
          Entrar no Painel
        </button>
      </form>
    </div>
  );
}