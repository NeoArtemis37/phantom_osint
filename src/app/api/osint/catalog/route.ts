import { NextRequest, NextResponse } from 'next/server';
import {
  OSINT_CATALOG,
  CATALOG_CATEGORIES,
  CATEGORY_LABELS,
  getCatalogByCategory,
  getCatalogByCategories,
  getCatalogStats,
  type CatalogCategory,
} from '@/lib/osint-catalog';

// =============================================================================
// PHANTOM — OSINT Catalog API
// =============================================================================
// Public reference endpoint (no auth — the catalog is curated static data).
//   GET  /api/osint/catalog                 → return all entries
//   GET  /api/osint/catalog?category=username → filter by single category
//   POST /api/osint/catalog                 → body { categories?: string[] }
//                                             returns the union of those
//                                             categories
//
// author: artemis37
// =============================================================================

function isCatalogCategory(value: string): value is CatalogCategory {
  return (CATALOG_CATEGORIES as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const categoryParam = params.get('category');

  let entries = OSINT_CATALOG;
  if (categoryParam) {
    if (!isCatalogCategory(categoryParam)) {
      return NextResponse.json(
        {
          error: `Invalid category. Valid categories: ${CATALOG_CATEGORIES.join(', ')}`,
          validCategories: CATALOG_CATEGORIES,
          categoryLabels: CATEGORY_LABELS,
        },
        { status: 400 }
      );
    }
    entries = getCatalogByCategory(categoryParam);
  }

  const stats = getCatalogStats();

  return NextResponse.json({
    author: 'artemis37',
    tool: 'OSINT Catalog',
    generatedAt: new Date().toISOString(),
    category: categoryParam ?? null,
    stats,
    categories: CATALOG_CATEGORIES,
    categoryLabels: CATEGORY_LABELS,
    total: entries.length,
    entries,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { categories } = body as { categories?: string[] };

    if (categories && !Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'categories must be an array of category strings' },
        { status: 400 }
      );
    }

    // Validate every requested category
    if (categories && categories.length > 0) {
      const invalid = categories.filter((c) => !isCatalogCategory(c));
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid categories: ${invalid.join(', ')}`,
            validCategories: CATALOG_CATEGORIES,
            categoryLabels: CATEGORY_LABELS,
          },
          { status: 400 }
        );
      }
      const typedCats = categories as CatalogCategory[];
      const entries = getCatalogByCategories(typedCats);
      const stats = getCatalogStats();
      return NextResponse.json({
        author: 'artemis37',
        tool: 'OSINT Catalog',
        generatedAt: new Date().toISOString(),
        categories: typedCats,
        stats,
        categoryLabels: CATEGORY_LABELS,
        total: entries.length,
        entries,
      });
    }

    // No filter — return everything
    const stats = getCatalogStats();
    return NextResponse.json({
      author: 'artemis37',
      tool: 'OSINT Catalog',
      generatedAt: new Date().toISOString(),
      categories: CATALOG_CATEGORIES,
      stats,
      categoryLabels: CATEGORY_LABELS,
      total: OSINT_CATALOG.length,
      entries: OSINT_CATALOG,
    });
  } catch (error) {
    console.error('OSINT catalog POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OSINT catalog' },
      { status: 500 }
    );
  }
}
