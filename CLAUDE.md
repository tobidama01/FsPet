# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

**Frontend (Next.js):**
```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

**Backend (Python/FastAPI — must run in `bot/` directory):**
```bash
cd bot
uvicorn main:app --reload   # Start bot API on localhost:8000
```

Both services must run simultaneously for the AI chatbot to work. The frontend falls back to keyword-matching if the backend is unreachable.

## Architecture

**FS PET Distribuidora** — single-page Next.js 16 catalog site. No routing; everything lives in `src/app/page.tsx`.

### Data layer
- `src/lib/products.ts` — static product catalog (~60 products across 6 categories). `Product` interface, `categories` array (with `id`, `name`, `icon`, `color`), and helper functions: `getProductsByCategory`, `searchProducts`, `getPromoProducts`, `getProductImage` (ID-based image map with category fallback).
- `src/lib/cart-context.tsx` — React Context cart with `addItem / removeItem / updateQuantity / clearCart / sendToWhatsApp`. `WHATSAPP_NUMBER` is hardcoded here. Cart opens automatically when an item is added.

### Component layout (`src/components/`)
- `Header.tsx` — search bar + cart icon badge; receives `onSearch` and `searchQuery` props from the page.
- `ProductCard.tsx` — renders a single product; calls `addItem` from `useCart()`.
- `Cart.tsx` — slide-over panel driven by `isCartOpen`; formats order and sends to WhatsApp via `sendToWhatsApp()`.
- `ChatBot.tsx` — fixed bottom-right floating widget. Calls `POST http://localhost:8000/chat` (configurable via `NEXT_PUBLIC_BOT_API` env var); falls back to local `FAQ` keyword-matching on failure.

### Page state (`src/app/page.tsx`)
Three mutually exclusive views are toggled by state: `selectedCategory`, `searchQuery`, and `showPromoOnly`. Switching any one resets the others. The catalog has two render modes: a grouped-by-category preview (home) and a flat grid (filtered/search).

### Bot backend (`bot/`)
- `main.py` — FastAPI app with a single `POST /chat` endpoint. Accepts `{ message, history[] }`, returns `{ reply }`. CORS allows only `localhost:3000`.
- `brain.py` — calls Gemini 2.0 Flash Lite via `google-genai` SDK. Uses an in-memory response cache keyed by MD5 hash (single-turn messages only). History is truncated to last 6 turns. Requires `GEMINI_API_KEY` in `bot/.env`.
- `bot/.env.example` shows the only required env var: `GEMINI_API_KEY=`.

### Styling
Tailwind CSS v4 with PostCSS. Brand palette: `#1B2A4A` (dark navy), `#F5C800` (yellow), `#89C4CF` (teal). Inter font via `next/font`.

### Product images
Static files in `public/products/`. The `IMAGE_MAP` in `products.ts` maps product IDs to file paths; missing entries fall back to another product in the same category.

### Business context
B2B/B2C distributor catalog. Flow: browse → add to cart → send pre-formatted WhatsApp message to `5551981529567`. No checkout, no payment, no login.
