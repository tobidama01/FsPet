import { PrismaClient } from "@prisma/client";
import { categories, products } from "../src/lib/products";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando a migração dos dados estáticos para o PostgreSQL...");

  // 1. Migrar Categorias
  console.log(`Migrando ${categories.length} categorias...`);
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
      },
      create: {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
      },
    });
  }
  console.log("Categorias migradas com sucesso!");

  // 2. Migrar Produtos
  console.log(`Migrando ${products.length} produtos...`);
  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        description: prod.description,
        price: prod.price,
        originalPrice: prod.originalPrice ?? null,
        category: prod.category,
        subcategory: prod.subcategory ?? null,
        ref: prod.ref ?? null,
        image: prod.image ?? null,
        isPromo: prod.isPromo ?? false,
        tags: prod.tags ?? [],
      },
      create: {
        id: prod.id,
        name: prod.name,
        description: prod.description,
        price: prod.price,
        originalPrice: prod.originalPrice ?? null,
        category: prod.category,
        subcategory: prod.subcategory ?? null,
        ref: prod.ref ?? null,
        image: prod.image ?? null,
        isPromo: prod.isPromo ?? false,
        tags: prod.tags ?? [],
      },
    });
  }
  console.log("Produtos migrados com sucesso!");
  console.log("Migração completa concluída sem falhas! 🎉");
}

main()
  .catch((e) => {
    console.error("Erro durante a migração dos dados:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
