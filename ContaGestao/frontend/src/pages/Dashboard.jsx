import { useState } from 'react';
import { FaSignOutAlt, FaUpload, FaFileAlt, FaHome } from 'react-icons/fa';
import Documentos from './Documentos';
import { apiRequest } from '../services/api';

export default function Dashboard({ onLogout }) {
  const [telaAtiva, setTelaAtiva] = useState('inicio');
  const [file, setFile] = useState(null);
  const [tipoDocumento, setTipoDocumento] = useState('auto');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setErro('Por favor, selecione um arquivo primeiro.');
      return;
    }

    setLoading(true);
    setErro('');
    setResultado(null);

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo_documento', tipoDocumento);

    try {
      const data = await apiRequest('/documentos', { method: 'POST', body: formData });
      setResultado(data);
    } catch (error) {
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dataString) => {
    if (!dataString) return 'Data não disponível';
    const data = new Date(dataString);
    return Number.isNaN(data.getTime()) ? 'Data não disponível' : data.toLocaleString('pt-BR');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar (Menu Lateral) */}
      <div style={{ width: '250px', backgroundColor: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', padding: '20px' }}>
        
        {/* Logo - Usando a pasta public */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px', color: '#ff8c00' }}>
          <img
            src="/logo-aguia.png"
            alt="Símbolo da ContaGestão: águia sobre um escudo com balança"
            style={{ width: '48px', height: '48px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '10px', padding: '2px' }}
          />
          <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>ContaGestão</h1>
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <button 
            onClick={() => setTelaAtiva('inicio')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: telaAtiva === 'inicio' ? '#1a1a1a' : 'transparent', color: telaAtiva === 'inicio' ? '#ff8c00' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
          >
            <FaHome /> Início
          </button>
          
          <button 
            onClick={() => setTelaAtiva('documentos')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: telaAtiva === 'documentos' ? '#1a1a1a' : 'transparent', color: telaAtiva === 'documentos' ? '#ff8c00' : '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}
          >
            <FaFileAlt /> Documentos
          </button>
          
        </nav>

        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'transparent', color: '#ff4444', border: 'none', cursor: 'pointer', marginTop: 'auto', fontSize: '16px' }}>
          <FaSignOutAlt /> Sair do Sistema
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div style={{ flex: 1, padding: '40px' }}>
        {telaAtiva === 'inicio' ? (
          <>
            <header style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '28px', margin: '0 0 10px 0' }}>Bem-vindo, Gestor</h2>
              <p style={{ color: '#888', margin: 0 }}>Envie seus documentos para extração automática.</p>
            </header>

            <div style={{ backgroundColor: '#1a1a1a', padding: '40px', borderRadius: '12px', maxWidth: '700px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}>
              <h3 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaUpload color="#ff8c00" /> Novo Documento
              </h3>
              
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Tipo de Documento:</label>
                  <select 
                    value={tipoDocumento} 
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#222', color: 'white', fontSize: '16px' }}
                  >
                    <option value="auto">Identificar automaticamente</option>
                    <option value="fatura">Fatura / Nota Fiscal</option>
                    <option value="contrato">Contrato</option>
                    <option value="formulario">Formulário</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Arquivo (PDF ou Imagem):</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#222', borderRadius: '8px', color: 'white', border: '1px solid #333' }}
                  />
                </div>

                {erro && <p style={{ color: '#ff4444', margin: 0 }}>{erro}</p>}

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ padding: '16px', backgroundColor: loading ? '#555' : '#ff8c00', color: 'black', fontWeight: 'bold', fontSize: '16px', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}
                >
                  {loading ? 'Processando (OCR + IA)...' : 'Enviar e Processar'}
                </button>
              </form>

              {resultado && (
                <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#0f2a1d', borderRadius: '8px', borderLeft: '5px solid #4caf50' }}>
                  <h3 style={{ color: '#4caf50', marginTop: 0, marginBottom: '15px' }}>
                    {resultado.duplicado ? 'Documento já processado' : 'Documento recebido'}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px', color: '#ddd' }}>
                    <div><strong>Arquivo:</strong> {resultado.documento?.nomeArquivo || 'N/A'}</div>
                    <div><strong>Tipo:</strong> {resultado.documento?.tipoDocumento || 'N/A'}</div>
                    <div><strong>Status:</strong> <span style={{ color: resultado.documento?.status === 'concluido' ? '#4caf50' : '#ff8c00' }}>{resultado.documento?.status || 'N/A'}</span></div>
                    <div><strong>Páginas:</strong> {resultado.documento?.paginas || 0}</div>
                    <div><strong>Enviado em:</strong> {formatarData(resultado.documento?.criadoEm)}</div>
                    <div><strong>Duplicado:</strong> {resultado.duplicado ? 'Sim' : 'Não'}</div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <Documentos />
        )}
      </div>
    </div>
  );
}