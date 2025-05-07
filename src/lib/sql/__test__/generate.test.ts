import { describe, expect, it } from "bun:test"
import { columnToSQL, createTableSQL } from "../generate";
import type { ColumnDefinition } from "../types";

const normalize = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("columnToSQL", () => {
    it("generates a basic INTEGER column", () => {
        const col: ColumnDefinition = { name: "id", type: "INTEGER" };
        expect(columnToSQL(col)).toBe(`"id" INTEGER`);
    });

    it("includes NOT NULL, UNIQUE, and DEFAULT", () => {
        const col: ColumnDefinition = {
            name: "username",
            type: "TEXT",
            notNull: true,
            unique: true,
            default: "guest",
        };
        expect(columnToSQL(col)).toBe(`"username" TEXT NOT NULL UNIQUE DEFAULT 'guest'`);
    });

    it("handles boolean and number defaults", () => {
        const col: ColumnDefinition = {
            name: "enabled",
            type: "BOOLEAN",
            default: true,
        };
        expect(columnToSQL(col)).toBe(`"enabled" BOOLEAN DEFAULT true`);
    });

    it("includes PRIMARY KEY and AUTOINCREMENT", () => {
        const col: ColumnDefinition = {
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true,
        };
        expect(columnToSQL(col)).toBe(`"id" INTEGER PRIMARY KEY AUTOINCREMENT`);
    });

    it("adds foreign key references with ON DELETE", () => {
        const col: ColumnDefinition = {
            name: "user_id",
            type: "INTEGER",
            references: {
                table: "users",
                column: "id",
                onDelete: "CASCADE",
            },
        };
        expect(columnToSQL(col)).toBe(
            `"user_id" INTEGER REFERENCES users(id) ON DELETE CASCADE`
        );
    });

    it("adds DEFAULT CURRENT_TIMESTAMP for created_at and updated_at if no explicit default", () => {
        const createdAtCol: ColumnDefinition = { name: "created_at", type: "TEXT" };
        const updatedAtCol: ColumnDefinition = { name: "updated_at", type: "TEXT" };
        expect(columnToSQL(createdAtCol)).toBe(`"created_at" TEXT DEFAULT CURRENT_TIMESTAMP`);
        expect(columnToSQL(updatedAtCol)).toBe(`"updated_at" TEXT DEFAULT CURRENT_TIMESTAMP`);
    });

    it("does not override explicit default for created_at and updated_at", () => {
        const createdAtCol: ColumnDefinition = { name: "created_at", type: "TEXT", default: "2023-01-01" };
        const updatedAtCol: ColumnDefinition = { name: "updated_at", type: "TEXT", default: "2023-01-01" };
        expect(columnToSQL(createdAtCol)).toBe(`"created_at" TEXT DEFAULT '2023-01-01'`);
        expect(columnToSQL(updatedAtCol)).toBe(`"updated_at" TEXT DEFAULT '2023-01-01'`);
    });
});

describe("createTableSQL", () => {
    it("creates a table with multiple columns", () => {
        const cols: ColumnDefinition[] = [
            { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
            { name: "x", type: "REAL", notNull: true },
            { name: "y", type: "REAL", notNull: true },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const actual = createTableSQL({ tableName: "coords", columns: cols });
        const expected = `CREATE TABLE IF NOT EXISTS "coords" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "x" REAL NOT NULL,
  "y" REAL NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);`;
        expect(normalize(actual)).toBe(normalize(expected));
    });

    it("includes references in full CREATE TABLE IF NOT EXISTS output", () => {
        const cols: ColumnDefinition[] = [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "page_id", type: "INTEGER", references: { table: "pages", column: "id" } },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const actual = createTableSQL({ tableName: "coords", columns: cols });
        const expected = `CREATE TABLE IF NOT EXISTS "coords" (
  "id" INTEGER PRIMARY KEY,
  "page_id" INTEGER REFERENCES pages(id),
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
);`;
        expect(normalize(actual)).toBe(normalize(expected));
    });
});

describe("createTableSQL with additional constraints", () => {
    it("includes a single CHECK constraint", () => {
        const cols: ColumnDefinition[] = [
            { name: "x", type: "REAL" },
            { name: "y", type: "REAL" },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const constraints = [
            "CHECK (x >= 0 AND y >= 0)"
        ];

        const actual = createTableSQL({ tableName: "coords", columns: cols, additionalConstraints: constraints });
        const expected = `CREATE TABLE IF NOT EXISTS "coords" ( "x" REAL, "y" REAL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (x >= 0 AND y >= 0)
  );`;
        expect(normalize(actual)).toBe(normalize(expected));
    });

    it("includes multiple constraints like UNIQUE and CHECK", () => {
        const cols: ColumnDefinition[] = [
            { name: "x", type: "REAL" },
            { name: "y", type: "REAL" },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const constraints = [
            "UNIQUE (x, y)",
            "CHECK (x BETWEEN 0 AND 100)"
        ];

        const actual = createTableSQL({ tableName: "coords", columns: cols, additionalConstraints: constraints });
        const expected = `CREATE TABLE IF NOT EXISTS "coords" (
    "x" REAL,
    "y" REAL,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (x, y),
    CHECK (x BETWEEN 0 AND 100)
  );`;
        expect(normalize(actual)).toBe(normalize(expected));
    });

    it("works with no constraints", () => {
        const cols: ColumnDefinition[] = [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const actual = createTableSQL({ tableName: "simple", columns: cols });
        const expected = `CREATE TABLE IF NOT EXISTS "simple" (
    "id" INTEGER PRIMARY KEY,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
  );`;
        expect(normalize(actual)).toBe(normalize(expected));
    });

    it("handles compound primary key as a constraint", () => {
        const cols: ColumnDefinition[] = [
            { name: "project_id", type: "INTEGER" },
            { name: "user_id", type: "INTEGER" },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ];

        const constraints = [
            "PRIMARY KEY (project_id, user_id)"
        ];

        const actual = createTableSQL({ tableName: "project_users", columns: cols, additionalConstraints: constraints });
        const expected = `CREATE TABLE IF NOT EXISTS "project_users" (
    "project_id" INTEGER,
    "user_id" INTEGER,
    "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
  );`;
        expect(normalize(actual)).toBe(normalize(expected));
    });
});
