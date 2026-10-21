# ContaGestão — frontend

Interface React para a API ContaGestão. Para iniciar:

```powershell
npm ci
npm run dev
```

O Vite lê as variáveis do `.env` na raiz do projeto. Por padrão, encaminha `/api` e `/health` para `http://localhost:8000`; defina `VITE_API_BASE_URL` quando a API estiver em outra origem. Nesse caso, libere a origem do frontend em `CORS_ORIGINS` no backend.

Comandos: `npm run lint` e `npm run build`.
