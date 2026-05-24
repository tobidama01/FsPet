from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from brain import get_reply, stream_reply, get_system_prompt

# Inicializar o rate limiter com base no endereço IP do cliente para mitigar DoS
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="FS PET Bot API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Restringir CORS: Apenas origens confiáveis para evitar roubo de dados via scripts maliciosos (XSS)
FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://fspet.com.br",  # Exemplo de URL de produção
]
# Permite customizar origens via variável de ambiente
if os.environ.get("ALLOWED_ORIGINS"):
    FRONTEND_ORIGINS.extend(os.environ["ALLOWED_ORIGINS"].split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class HistoryEntry(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryEntry] = []


class ChatResponse(BaseModel):
    reply: str


# Limite de 15 requisições por minuto por IP para evitar abuso do modelo de IA (Gemini) e DoS
@app.post("/chat", response_model=ChatResponse)
@limiter.limit("15/minute")
async def chat(request: Request, req: ChatRequest) -> ChatResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is empty")

    history = [h.model_dump() for h in req.history]
    system_prompt = await get_system_prompt()
    reply = get_reply(req.message, history, system_prompt)
    return ChatResponse(reply=reply)


# Limite para streaming de chat
@app.post("/chat/stream")
@limiter.limit("15/minute")
async def chat_stream(request: Request, req: ChatRequest) -> StreamingResponse:
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is empty")

    history = [h.model_dump() for h in req.history]
    system_prompt = await get_system_prompt()

    def generate():
        for chunk in stream_reply(req.message, history, system_prompt):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


@app.get("/health")
async def health(request: Request) -> dict:
    return {"status": "ok"}
