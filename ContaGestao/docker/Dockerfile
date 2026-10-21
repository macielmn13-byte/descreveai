# syntax=docker/dockerfile:1.7
# =====================================================================
#  ContaGestão – Soluções Inteligentes
#  Imagem única para API e worker (o comando define o papel).
# =====================================================================

# ---------- 1) dependências de produção ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Ferramentas de compilação só para o caso de algum módulo nativo
# (better-sqlite3, sharp) não ter binário pronto para a plataforma.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ---------- 2) imagem final ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8000 \
    STORAGE_LOCAL_PATH=/app/data/storage \
    TESSERACT_CMD=tesseract \
    TESSERACT_LANG=por+eng

# Tesseract 5 com português + fontes para renderizar PDFs sem fontes embutidas
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-por tesseract-ocr-eng tesseract-ocr-osd \
      fonts-dejavu-core fonts-liberation tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

RUN mkdir -p /app/data/storage && chown -R node:node /app/data
USER node

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
