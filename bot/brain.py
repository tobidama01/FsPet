import hashlib
import os
import time
import asyncpg
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError

# Resolve o caminho para o .env no diretório raiz de forma absoluta e independente do diretório de execução (CWD)
current_dir = os.path.dirname(os.path.abspath(__file__))
root_env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(dotenv_path=root_env_path)

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT_TEMPLATE = """Você é Paty, a assistente virtual simpática e prestativa da FS PET Distribuidora. Seu tom é amigável, acolhedor e direto — como uma atendente experiente que ama animais.

## Sobre a FS PET
- Distribuidora de produtos pet localizada no Rio Grande do Sul
- Atendimento: segunda a sexta das 8h às 18h, sábado das 8h às 12h
- WhatsApp comercial: (51) 9533-4385 — canal principal de vendas, orçamentos e atendimento personalizado
- Como funciona: o cliente navega no site, adiciona produtos ao carrinho e envia o orçamento diretamente pelo WhatsApp
- Entregas: toda a região; frete calculado conforme localização, consultar pelo WhatsApp

## Formas de pagamento
PIX (chave enviada pelo WhatsApp), boleto bancário, cartão de crédito/débito (mediante consulta)

## Catálogo de Produtos
{catalog}

## Regras de comportamento
1. Responda SEMPRE em português brasileiro, de forma natural e amigável
2. Use emojis com moderação (máx. 2 por mensagem) para tornar o tom mais leve
3. Para pedidos ou orçamentos, direcione sempre ao WhatsApp: (51) 9533-4385
4. Mantenha respostas curtas e objetivas — no máximo 3 parágrafos
5. Para questões de saúde animal, sempre recomende consultar um veterinário
6. Não invente produtos fora do catálogo acima
7. Se não souber algo, diga que não tem certeza e indique o WhatsApp para consulta
8. Nunca mencione concorrentes ou faça comparações negativas
9. Seu nome é Paty
10. Se o cliente quiser falar com um atendente humano, ou usar variações como "falar com uma pessoa", "suporte humano", "quero falar com alguém", "atendimento humano", "falar com a loja" etc., responda com algo como: "Claro! 😊 Clique no botão verde **'Falar com atendente'** abaixo, ou acesse diretamente nosso WhatsApp: (51) 9533-4385. Nossa equipe está pronta para te atender!"
"""

# Fallback estático caso ocorra alguma falha na conexão com o banco de dados
SYSTEM_PROMPT_FALLBACK = SYSTEM_PROMPT_TEMPLATE.replace("{catalog}", """
**Cães**
- Comedouros/Bebedouros anti-formiga: 350ml (R$3,74 🔥promoção), 1000ml (R$6,87 🔥promoção), 1900ml (R$11,99 🔥promoção)
- Comedouros de alumínio pesado: Grande 2300ml (R$24,99 🔥promoção), Gigante 2800ml (R$29,99 🔥promoção)
- Bebedouro portátil para passeios (R$35,90), Fonte/Dispenser automático (R$89,90)
- Guias de corda com amortecedor: 0,80m 12mm (R$13,99), 0,60m 16mm (R$18,10), 1,00m 16mm (R$15,15)
- Guia de adestramento com enforcador 0,80m (R$7,35), Guia nylon 57cm (R$24,40)
- Coleiras nylon ajustável: P (R$12,50), M (R$15,90), G (R$19,90)
- Peitorais: P (R$28,90), M (R$35,90)
- Camas acolchoadas: P (R$45,00), M (R$65,00), G (R$89,00)
- Brinquedos: corda (R$18,90), mordedor látex (R$14,90), bola (R$12,90)

**Gatos**
- Areia sanitária 4kg (R$22,90), Caixa de areia (R$38,90)
- Arranhador torre multi-andares sisal (R$119,90), Arranhador simples sisal (R$45,90)
- Comedouro duplo (R$28,90), Cama/Ninho acolchoado (R$55,90)
- Varinha interativa com pena (R$19,90)

**Banho, Tosa & Higiene**
- Shampoo para cães 500ml (R$18,90), Shampoo para gatos 500ml (R$18,90)
- Condicionador pet 500ml (R$22,90), Colônia/Perfume pet 100ml (R$25,90)
- Escova para pelo (R$28,90), Lenços umedecidos 50un (R$12,90)
- Antipulgas spray 250ml/30 dias (R$32,90)
- Tesoura de tosa profissional aço inox (R$45,90)
- Máquina de tosa elétrica silenciosa kit pentes (R$189,90)
- Soprador Kyklon profissional alta performance (R$299,90)

**Petiscos**
- Ossinho natural de boi (R$8,90), Bifinho carne 65g (R$7,90)
- Jerky de frango desidratado 100g (R$12,90), Petisco sachê gatos 85g (R$5,90)
- Snack dental reduz tártaro (R$9,90), Ração Finicat para gatos (R$29,90)

**Animais Pequenos**
- Canecas alumínio borboleta para gaiola: P (R$5,99), M (R$7,60), G (R$9,40)
- Banheiras alumínio para pássaros: P (R$4,60), M (R$5,20), G (R$5,60)
- Gaiola para pássaros média (R$89,90), Gaiola para hamster com acessórios (R$65,90)
- Alimento/mix sementes pássaros 500g (R$12,90)

**Veterinário**
- Vermífugo para cães comprimido (R$18,90), Vermífugo para gatos comprimido (R$18,90)
- Antipulgas pipeta tópica (R$28,90), Suplemento articular glucosamina (R$55,90)
- Colar elizabetano plástico P (R$15,90), Seringa medicamento oral 10ml (R$6,90)
""")

_cached_prompt = None
_cache_timestamp = 0
CACHE_TTL = 300  # 5 minutos

async def get_system_prompt() -> str:
    global _cached_prompt, _cache_timestamp
    now = time.time()
    
    # Retornar cache em memória se dentro do TTL
    if _cached_prompt and (now - _cache_timestamp < CACHE_TTL):
        return _cached_prompt

    try:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL não configurada no ambiente")

        # Conectar ao banco com SSL/TLS criptografado obrigatório
        conn = await asyncpg.connect(db_url, ssl="require")
        
        # Buscar Categorias
        categories = await conn.fetch("SELECT id, name, icon FROM \"Category\"")
        # Buscar Produtos
        products = await conn.fetch(
            "SELECT id, name, price, \"isPromo\", category, subcategory FROM \"Product\" ORDER BY category ASC, price ASC"
        )
        await conn.close()

        # Mapeamento de categorias ordenadas
        order = ["caes", "gatos", "banho-tosa-higiene", "petiscos", "animais-pequenos", "vet"]
        sorted_categories = sorted(
            categories,
            key=lambda c: order.index(c["id"]) if c["id"] in order else 99
        )

        catalog_lines = []
        for cat in sorted_categories:
            cat_id = cat["id"]
            cat_name = cat["name"]
            
            # Filtrar produtos desta categoria
            cat_prods = [p for p in products if p["category"] == cat_id]
            if not cat_prods:
                continue
            
            catalog_lines.append(f"\n**{cat_name}**")
            for p in cat_prods:
                promo_flag = " 🔥promoção" if p["isPromo"] else ""
                price_formatted = f"R${p['price']:.2f}".replace('.', ',')
                catalog_lines.append(f"- {p['name']}: {price_formatted}{promo_flag}")

        catalog_str = "\n".join(catalog_lines)
        _cached_prompt = SYSTEM_PROMPT_TEMPLATE.replace("{catalog}", catalog_str)
        _cache_timestamp = now
        
        return _cached_prompt
    except Exception as e:
        print(f"[Database Error] Falha ao carregar catálogo dinâmico do PostgreSQL: {e}")
        # Fallback seguro para manter a Paty online
        return SYSTEM_PROMPT_FALLBACK


_cache: dict[str, str] = {}
MAX_HISTORY = 6


def _build_contents(message: str, history: list[dict]) -> list[types.Content]:
    contents: list[types.Content] = []
    for h in history[-MAX_HISTORY:]:
        role = "model" if h["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=h["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))
    return contents


def get_reply(message: str, history: list[dict], system_prompt: str) -> str:
    cache_key = hashlib.md5(message.lower().strip().encode()).hexdigest() if not history else None

    if cache_key and cache_key in _cache:
        return _cache[cache_key]

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=400,
        temperature=0.7,
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=_build_contents(message, history),
        config=config,
    )

    reply: str = response.text or "Desculpe, não consegui processar sua pergunta. Tente novamente!"

    if cache_key:
        _cache[cache_key] = reply

    return reply


_QUOTA_MSG = (
    "Estou com muitos atendimentos no momento e não consigo responder agora. 😊 "
    "Para ajuda imediata, fale conosco pelo WhatsApp: (51) 9533-4385!"
)


def stream_reply(message: str, history: list[dict], system_prompt: str):
    cache_key = hashlib.md5(message.lower().strip().encode()).hexdigest() if not history else None

    if cache_key and cache_key in _cache:
        yield _cache[cache_key]
        return

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=400,
        temperature=0.7,
    )

    try:
        full_reply = ""
        for chunk in client.models.generate_content_stream(
            model=MODEL,
            contents=_build_contents(message, history),
            config=config,
        ):
            if chunk.text:
                full_reply += chunk.text
                yield chunk.text

        if cache_key and full_reply:
            _cache[cache_key] = full_reply

    except ClientError as e:
        if getattr(e, 'code', None) == 429:
            yield _QUOTA_MSG
        else:
            yield f"Ocorreu um erro no servidor (API). Detalhes: {str(e)}"
    except Exception as e:
        yield f"Desculpe, ocorreu um erro inesperado: {str(e)}"
