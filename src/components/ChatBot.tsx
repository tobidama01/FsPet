"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, ChevronDown, ChevronUp, Bot, Send } from "lucide-react";

interface Message {
  role: "user" | "bot";
  text: string;
}

// ── Fallback local (usado se o backend Python não estiver rodando) ────────────
const FAQ: Record<string, string> = {
  "horário": "🕐 Nosso atendimento é de segunda a sexta das 8h às 18h e sábados das 8h às 12h.",
  "entrega": "🚚 Entregamos em toda a região! Consulte prazo e frete pelo WhatsApp.",
  "frete": "🚚 O frete é calculado pela sua localização. Fale conosco pelo WhatsApp para um orçamento completo.",
  "pagamento": "💳 Aceitamos PIX, boleto bancário e cartão de crédito/débito (mediante consulta).",
  "pix": "💳 Aceitamos PIX! Ao fechar o pedido pelo WhatsApp, te passamos a chave.",
  "promoção": "🏷️ Sim! Temos promoções com preços especiais. Veja a seção 'Promoções' no topo da página.",
  "desconto": "🏷️ Para compras em volume temos descontos especiais. Consulte pelo WhatsApp!",
  "pedido": "📦 Adicione os produtos ao carrinho e clique em 'Enviar pelo WhatsApp' para receber o orçamento.",
  "comprar": "📦 Adicione os produtos ao carrinho e envie pelo WhatsApp para confirmar o pedido.",
  "whatsapp": "📱 Nosso WhatsApp é (51) 9533-4385. É o canal principal de vendas e atendimento.",
  "petisco": "🦴 Trabalhamos com ossinhos naturais, bifinhos, jerky de frango, sachês para gatos e snacks dentais.",
  "ração": "🍖 Temos ração para gatos (Finicat). Consulte-nos pelo WhatsApp para outras marcas.",
  "banho": "🛁 Temos shampoos, condicionadores, perfumes e acessórios profissionais de grooming.",
  "tosa": "✂️ Temos máquinas de tosa elétricas, tesouras profissionais e soprador Kyklon.",
  "gato": "🐈 Para gatos: arranhadores, comedouros, camas, areia sanitária, brinquedos e muito mais!",
  "cachorro": "🐕 Para cães: coleiras, guias, peitorais, comedouros, camas e brinquedos.",
  "pássaro": "🐦 Para aves: canecas de alumínio, banheiras e gaiolas na categoria 'Animais Pequenos'.",
  "hamster": "🐹 Temos gaiola completa com acessórios para hamsters! Categoria 'Animais Pequenos'.",
  "veterinário": "⚕️ Temos vermífugos, antipulgas e suplementos. Consulte sempre um médico-veterinário.",
  "ola": "👋 Olá! Sou a Paty, assistente da FS PET. Posso ajudar com horários, produtos, entregas e pagamentos!",
  "olá": "👋 Olá! Sou a Paty, assistente da FS PET. Como posso ajudar?",
  "oi": "👋 Oi! Sou a Paty da FS PET. Em que posso ajudar você hoje?",
  "obrigad": "😊 De nada! Qualquer dúvida é só chamar. 🐾",
  "localização": "📍 Somos uma distribuidora com atendimento online e entregas. Para retirada no local, consulte pelo WhatsApp.",
  "endereço": "📍 Atendemos de forma online com entregas. Para retirada, entre em contato pelo WhatsApp.",
  "contato": "📱 O melhor canal é o WhatsApp: (51) 9533-4385. Nossa equipe vai te atender!",
  "atendente": "👤 Claro! Clique no botão verde **'Falar com atendente'** ou acesse diretamente: wa.me/555195334385 — nossa equipe responde pelo WhatsApp!",
  "humano": "👤 Prefere falar com uma pessoa? Use o botão **'Falar com atendente'** abaixo ou nos chame no WhatsApp: (51) 9533-4385!",
  "pessoa": "👤 Sem problema! Nossa equipe está disponível no WhatsApp: (51) 9533-4385. Clique em **'Falar com atendente'** abaixo.",
  "suporte": "📱 Para suporte direto, fale conosco pelo WhatsApp: (51) 9533-4385. Clique em **'Falar com atendente'** abaixo!",
  "falar com": "👤 Para falar com nossa equipe diretamente, clique em **'Falar com atendente'** ou acesse o WhatsApp: (51) 9533-4385.",
};

function getFallbackResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(FAQ)) {
    if (lower.includes(key)) return response;
  }
  return "🤔 Não tenho certeza sobre isso. Para informações detalhadas, entre em contato pelo nosso WhatsApp: (51) 9533-4385 — nossa equipe te ajuda!";
}

const WA_ATENDENTE_URL =
  "https://wa.me/555195334385?text=" +
  encodeURIComponent("Olá! Gostaria de falar com um atendente da FS PET.");

// ── Quick-reply chips exibidos antes do primeiro envio ───────────────────────
type QuickReply =
  | { label: string; text: string; action?: never }
  | { label: string; action: () => void; text?: never };

const QUICK_REPLIES: QuickReply[] = [
  { label: "⏰ Horário de atendimento", text: "Qual o horário de atendimento?" },
  { label: "🚚 Como funciona a entrega?", text: "Como funciona a entrega?" },
  { label: "💳 Formas de pagamento", text: "Quais formas de pagamento vocês aceitam?" },
  { label: "🏷️ Tem promoções?", text: "Vocês têm promoções agora?" },
  { label: "📦 Como fazer um pedido?", text: "Como faço um pedido?" },
  { label: "👤 Falar com atendente", action: () => window.open(WA_ATENDENTE_URL, "_blank") },
];

const BOT_API = process.env.NEXT_PUBLIC_BOT_API ?? "http://localhost:8000";

async function fetchBotStream(
  message: string,
  history: Message[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  try {
    const res = await fetch(`${BOT_API}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.map((m) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.text,
        })),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok || !res.body) throw new Error("api_error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) onChunk(chunk);
    }
  } catch {
    onChunk(getFallbackResponse(message));
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "👋 Olá! Sou a **Paty**, assistente da FS PET. Posso ajudar com informações sobre horários, entregas, pagamentos e produtos. Escolha uma opção abaixo ou escreva sua pergunta!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUserSent, setHasUserSent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || isLoading) return;

    const userMsg: Message = { role: "user", text: msgText };
    const currentHistory = messages;
    setMessages((prev) => [...prev, userMsg, { role: "bot", text: "" }]);
    setInput("");
    setIsLoading(true);
    setHasUserSent(true);

    await fetchBotStream(msgText, currentHistory, (chunk) => {
      setIsLoading(false);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          text: updated[updated.length - 1].text + chunk,
        };
        return updated;
      });
    });

    setIsLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const WELCOME_MESSAGE: Message = {
    role: "bot",
    text: "👋 Olá! Sou a **Paty**, assistente da FS PET. Posso ajudar com informações sobre horários, entregas, pagamentos e produtos. Escolha uma opção abaixo ou escreva sua pergunta!",
  };

  const handleOpen = () => {
    if (isOpen) {
      setMessages([WELCOME_MESSAGE]);
      setHasUserSent(false);
      setIsLoading(false);
    }
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 bg-[#F5C800] text-[#1B2A4A] rounded-full w-16 h-16 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform duration-200"
        aria-label="Abrir chat de assistência"
        id="chatbot-toggle"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden transition-all duration-200"
          style={{ maxHeight: isMinimized ? "56px" : "520px", height: isMinimized ? "56px" : "520px" }}
        >
          {/* Header */}
          <div className="bg-[#1B2A4A] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-[#F5C800]" />
              <div>
                <p className="font-semibold text-sm">Paty · FS PET</p>
                <p className="text-xs text-green-400">● Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-300 hover:text-white transition-colors"
              aria-label={isMinimized ? "Expandir chat" : "Minimizar chat"}
            >
              {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#1B2A4A] text-white rounded-br-sm"
                          : "bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100"
                      }`}
                    >
                      {msg.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && messages[messages.length - 1]?.text === "" && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                {/* Quick reply chips (shown only before first user message) */}
                {!hasUserSent && !isLoading && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr.label}
                        onClick={() => qr.action ? qr.action() : sendMessage(qr.text)}
                        className={`text-xs border rounded-full px-3 py-1.5 transition-colors shadow-sm font-medium ${
                          qr.action
                            ? "bg-green-500 border-green-500 text-white hover:bg-green-600"
                            : "bg-white border-[#F5C800] text-[#1B2A4A] hover:bg-[#F5C800] hover:text-[#1B2A4A]"
                        }`}
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t bg-white flex gap-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Escreva sua pergunta..."
                  disabled={isLoading}
                  className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-[#F5C800] focus:ring-1 focus:ring-[#F5C800] disabled:opacity-50"
                  id="chatbot-input"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="bg-[#F5C800] text-[#1B2A4A] rounded-full w-9 h-9 flex items-center justify-center hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Enviar mensagem"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
