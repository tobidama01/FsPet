import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const dbCategories = await prisma.category.findMany();
    
    // Garantir uma ordenação consistente das categorias
    const order = ["caes", "gatos", "banho-tosa-higiene", "petiscos", "animais-pequenos", "vet"];
    const sortedCategories = dbCategories.sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      return (indexA !== -1 ? indexA : 99) - (indexB !== -1 ? indexB : 99);
    });

    return NextResponse.json(sortedCategories);
  } catch (error) {
    console.error("Erro ao buscar categorias no banco de dados:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao consultar o banco de dados." },
      { status: 500 }
    );
  }
}
