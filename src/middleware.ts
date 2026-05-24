import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cache em memória para rastreamento de taxa (Rate Limiting) por IP
// Chave: IP do cliente, Valor: Array de carimbos de data/hora (timestamps) das requisições
const rateLimitMap = new Map<string, number[]>();

// Configurações do Limitador de Taxa
const WINDOW_MS = 60 * 1000; // Janela de 1 minuto
const MAX_REQUESTS = 60;     // Máximo de 60 requisições por minuto por IP

// Limpeza periódica em segundo plano para evitar vazamento de memória
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter((time) => now - time < WINDOW_MS);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
}, 5 * 60 * 1000); // Executa a cada 5 minutos

export function middleware(request: NextRequest) {
  // Aplicar apenas para rotas sob /api/
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip = (request as any).ip || request.headers.get("x-forwarded-for") || "127.0.0.1";
    const now = Date.now();

    let timestamps = rateLimitMap.get(ip) || [];
    
    // Filtrar requisições que estão fora da janela de tempo atual
    timestamps = timestamps.filter((time) => now - time < WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS) {
      console.warn(`[Rate Limit Exceeded] IP: ${ip} bloqueado temporariamente por excesso de requisições na rota: ${request.nextUrl.pathname}`);
      return new NextResponse(
        JSON.stringify({
          error: "Limite de requisições excedido. Por favor, tente novamente mais tarde.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    // Registrar o timestamp da requisição atual
    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
  }

  // Configurar cabeçalhos de segurança básicos (Segurança de cabeçalhos HTTP)
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:8000 http://127.0.0.1:8000; frame-ancestors 'none';"
  );

  return response;
}

// Configurar o middleware para interceptar apenas rotas de API
export const config = {
  matcher: "/api/:path*",
};
