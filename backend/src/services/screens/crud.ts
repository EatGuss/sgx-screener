import { and, desc, eq } from "drizzle-orm";
import {
  SavedScreen,
  ScreenSpec,
  ScreenerField,
  type SavedScreen as SavedScreenType,
  type ScreenSpec as ScreenSpecType,
  type ScreenerField as ScreenerFieldType,
} from "screener-contract";
import { db } from "../../db/drizzleClient";
import { savedScreens } from "../../models/screener/savedScreens";

export class ScreenNotFoundError extends Error {
  constructor(id: number) {
    super(`Screen not found: ${id}`);
    this.name = "ScreenNotFoundError";
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

/** Columns + optional AI/user description live next to ScreenSpec in jsonb. */
type StoredFilterDsl = ScreenSpecType & {
  columns?: ScreenerFieldType[];
  description?: string;
};

function parseStored(raw: unknown): {
  spec: ScreenSpecType;
  columns?: ScreenerFieldType[];
  description?: string;
} {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const columnsRaw = record.columns;
  let columns: ScreenerFieldType[] | undefined;
  if (Array.isArray(columnsRaw)) {
    const parsed = ScreenerField.array().safeParse(columnsRaw);
    if (parsed.success && parsed.data.length > 0) {
      columns = parsed.data;
    }
  }
  let description: string | undefined;
  if (typeof record.description === "string") {
    const trimmed = record.description.trim();
    if (trimmed) description = trimmed.slice(0, 280);
  }
  const spec = ScreenSpec.parse(record);
  return { spec, columns, description };
}

function toStored(
  spec: ScreenSpecType,
  columns?: ScreenerFieldType[],
  description?: string | null,
): StoredFilterDsl {
  const validated = ScreenSpec.parse(spec);
  const stored: StoredFilterDsl = { ...validated };
  if (columns != null && columns.length > 0) {
    stored.columns = ScreenerField.array().parse(columns);
  }
  if (description != null) {
    const trimmed = description.trim().slice(0, 280);
    if (trimmed) stored.description = trimmed;
  }
  return stored;
}

function rowToSavedScreen(row: typeof savedScreens.$inferSelect): SavedScreenType {
  const { spec, columns, description } = parseStored(row.filterDsl);
  return SavedScreen.parse({
    id: row.id,
    name: row.name,
    spec,
    ...(columns ? { columns } : {}),
    ...(description ? { description } : {}),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  });
}

export async function listSavedScreens(
  userId: number,
): Promise<SavedScreenType[]> {
  const rows = await db
    .select()
    .from(savedScreens)
    .where(eq(savedScreens.userId, userId))
    .orderBy(desc(savedScreens.updatedAt));

  return rows.map(rowToSavedScreen);
}

export async function createSavedScreen(
  userId: number,
  name: string,
  spec: ScreenSpecType,
  columns?: ScreenerFieldType[],
  description?: string,
): Promise<SavedScreenType> {
  const filterDsl = toStored(spec, columns, description);
  const [row] = await db
    .insert(savedScreens)
    .values({
      userId,
      name: name.trim(),
      filterDsl,
      updatedAt: new Date(),
    })
    .returning();

  if (!row) throw new Error("Failed to create saved screen");
  return rowToSavedScreen(row);
}

export async function updateSavedScreen(
  userId: number,
  id: number,
  patch: {
    name?: string;
    spec?: ScreenSpecType;
    columns?: ScreenerFieldType[];
    description?: string;
  },
): Promise<SavedScreenType> {
  const existing = await db
    .select()
    .from(savedScreens)
    .where(and(eq(savedScreens.id, id), eq(savedScreens.userId, userId)))
    .limit(1);

  if (!existing[0]) throw new ScreenNotFoundError(id);

  const prev = parseStored(existing[0].filterDsl);
  const nextName = patch.name?.trim() ?? existing[0].name;
  const nextSpec =
    patch.spec != null ? ScreenSpec.parse(patch.spec) : prev.spec;
  // `columns` in the patch (including []) replaces; undefined keeps previous.
  const nextColumns =
    patch.columns !== undefined ? patch.columns : prev.columns;
  // Same for description: explicit "" clears; undefined keeps previous.
  const nextDescription =
    patch.description !== undefined ? patch.description : prev.description;

  const [row] = await db
    .update(savedScreens)
    .set({
      name: nextName,
      filterDsl: toStored(nextSpec, nextColumns, nextDescription ?? null),
      updatedAt: new Date(),
    })
    .where(and(eq(savedScreens.id, id), eq(savedScreens.userId, userId)))
    .returning();

  if (!row) throw new ScreenNotFoundError(id);
  return rowToSavedScreen(row);
}

export async function deleteSavedScreen(
  userId: number,
  id: number,
): Promise<void> {
  const deleted = await db
    .delete(savedScreens)
    .where(and(eq(savedScreens.id, id), eq(savedScreens.userId, userId)))
    .returning({ id: savedScreens.id });

  if (deleted.length === 0) throw new ScreenNotFoundError(id);
}
