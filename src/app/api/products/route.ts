import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// API para buscar produtos com filtros seguros (prevenção de SQL Injection nativa via Prisma Client)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const promo = searchParams.get("promo");

    // Construção segura do objeto de condições
    const where: any = {};

    if (promo === "true") {
      where.isPromo = true;
    }

    if (category && category !== "todos") {
      where.category = category;
    }

    if (search && search.trim() !== "") {
      const normalizedSearch = search.trim();
      where.OR = [
        { name: { contains: normalizedSearch, mode: "insensitive" } },
        { description: { contains: normalizedSearch, mode: "insensitive" } },
        { category: { contains: normalizedSearch, mode: "insensitive" } },
        { subcategory: { contains: normalizedSearch, mode: "insensitive" } },
        { ref: { contains: normalizedSearch, mode: "insensitive" } },
        { tags: { has: normalizedSearch } }, // Busca exata em tags
      ];
    }

    const dbProducts = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(dbProducts);
  } catch (error) {
    console.error("Erro ao buscar produtos no banco de dados:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao consultar o banco de dados." },
      { status: 500 }
    );
  }
}
