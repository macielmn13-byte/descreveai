import { useState, useEffect } from 'react';
import { FaSync, FaFileAlt } from 'react-icons/fa';
import { apiRequest } from '../services/api';

export default function Documentos() {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null);

  const buscarDocumentos = async () => {
    setLoading(true);
    setErro('');

    try {
      const data = await apiRequest('/documentos');
      setDocumentos(data.itens ?? []);
    } catch (error) {
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiRequest('/documentos')
      .then((data) => {
        if (active) setDocumentos(data.itens ?? []);
      })
      .catch((error) => {
        if (active) setErro(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const formatarData = (dataString) => {
    if (!dataString) return 'N/A';
    const data = new Date(dataString);
    return Number.isNaN(data.getTime()) ? 'N/A' : data.toLocaleString('pt-BR');
  };

  const coresStatus = {
    concluido: { fundo: '#0f2a1d', texto: '#4caf50' },
    recebido: { fundo: '#2a1f0f', texto: '#ff8c00' },
    processando: { fundo: '#2a1f0f', texto: '#ff8c00' },
    revisao: { fundo: '#2a2510', texto: '#f0c419' },
    erro: { fundo: '#2a1010', texto: '#ff6b6b' }
  };

  if (documentoSelecionado) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
        <button onClick={() => setDocumentoSelecionado(null)} style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginBottom: '30px' }}>← Voltar</button>
        <div style={{ backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '12px', maxWidth: '800px' }}>
          <h2 style={{ color: '#ff8c00' }}>Detalhes do Documento</h2>
          <p><strong>Arquivo:</strong> {documentoSelecionado.nomeArquivo}</p>
          <p><strong>Status:</strong> {documentoSelecionado.status}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', backgroundColor: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '28px', margin: 0 }}>Histórico de Documentos</h2>
        <button onClick={buscarDocumentos} disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          <FaSync /> {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {erro && <p style={{ color: '#ff4444' }}>{erro}</p>}

      {loading ? (
        <p>Carregando...</p>
      ) : documentos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', backgroundColor: '#1a1a1a', borderRadius: '10px' }}>
          <FaFileAlt size={40} color="#555" />
          <p style={{ color: '#888', marginTop: '15px' }}>Nenhum documento encontrado.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#1a1a1a', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333', color: '#888' }}>
                <th style={{ padding: '15px' }}>Arquivo</th>
                <th style={{ padding: '15px' }}>Status</th>
                <th style={{ padding: '15px' }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => {
                const corStatus = coresStatus[doc.status] ?? { fundo: '#222', texto: '#ddd' };
                return (
                  <tr key={doc.id} onClick={() => setDocumentoSelecionado(doc)} style={{ borderBottom: '1px solid #222', cursor: 'pointer' }}>
                    <td style={{ padding: '15px' }}>{doc.nomeArquivo}</td>
                    <td style={{ padding: '15px' }}>
                      <span style={{ backgroundColor: corStatus.fundo, color: corStatus.texto, padding: '4px 8px', borderRadius: '5px' }}>
                        {doc.status}
                      </span>
                    </td>
                    <td style={{ padding: '15px' }}>{formatarData(doc.criadoEm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}