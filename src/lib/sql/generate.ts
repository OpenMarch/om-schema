import type { ColumnDefinition, NewTableArgs } from "./types";

/**
 * Converts a column definition to a SQL column specification string.
 *
 * @param col - The column definition object containing column properties
 * @returns A SQL string representing the column specification with all defined attributes
 */
export function columnToSQL(col: ColumnDefinition): string {
    const parts = [`"${col.name}"`, col.type];

    if (col.primaryKey) parts.push("PRIMARY KEY");
    if (col.autoIncrement) parts.push("AUTOINCREMENT");
    if (col.notNull) parts.push("NOT NULL");
    if (col.unique) parts.push("UNIQUE");

    if (col.default !== undefined) {
        const val =
            typeof col.default === "string" ? `'${col.default}'` : col.default;
        parts.push(`DEFAULT ${val}`);
    } else if (col.name === "created_at" || col.name === "updated_at") {
        parts.push("DEFAULT CURRENT_TIMESTAMP");
    }

    if (col.references) {
        parts.push(
            `REFERENCES ${col.references.table}(${col.references.column})`,
        );
        if (col.references.onDelete) {
            parts.push(`ON DELETE ${col.references.onDelete}`);
        }
    }

    return parts.join(" ");
}

/**
 * Generates a SQL CREATE TABLE statement for a given table name and column definitions.
 *
 * @param tableName - The name of the table to be created
 * @param columns - An array of column definitions specifying the table's structure
 * @param constraints - Optional array of additional SQL constraints to add to the table
 * @returns A complete SQL CREATE TABLE statement as a string
 */
export function createTableSQL({
    tableName,
    columns,
    constraints = [],
}: NewTableArgs): string {
    const columnNames = columns.map((col) => col.name);
    const cols = [...columns];
    if (!columnNames.includes("created_at")) {
        cols.push({ name: "created_at", type: "TEXT" });
    }
    if (!columnNames.includes("updated_at")) {
        cols.push({ name: "updated_at", type: "TEXT" });
    }
    const columnSQL = cols.map(columnToSQL).join(",\n  ");
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnSQL}${constraints.length > 0 ? `,\n  ${constraints.join(",\n  ")}` : ""}\n);`;
}
