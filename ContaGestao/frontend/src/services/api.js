const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, '') : '';

export async function apiRequest(path, { apiKey, headers: initialHeaders, ...options } = {}) {
  const headers = new Headers(initialHeaders);
  const key = apiKey ?? localStorage.getItem('apiKey');
  if (key) headers.set('X-API-Key', key);

  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/v1${path}`, { ...options, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Não foi possível conectar à API. Verifique se o servidor está no ar.', { cause: error });
    }
    throw error;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const data = response.status === 204 ? null : contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.erro ?? `Falha na API (HTTP ${response.status})`);
  return data;
}
