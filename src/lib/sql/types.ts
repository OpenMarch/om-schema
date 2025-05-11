/**
 * Represents the definition of a column in a database table.
 * Provides detailed configuration options for column properties.
 *
 * @property {string} name - The name of the column.
 * @property {"INTEGER" | "REAL" | "TEXT" | "BLOB" | "BOOLEAN"} type - The data type of the column.
 * @property {boolean} [primaryKey] - Indicates if the column is a primary key.
 * @property {boolean} [notNull] - Indicates if the column cannot contain null values.
 * @property {boolean} [unique] - Indicates if the column values must be unique.
 * @property {string | number | boolean | null} [default] - The default value for the column.
 * @property {boolean} [autoIncrement] - Indicates if the column should auto-increment.
 * @property {Object} [references] - Foreign key reference configuration.
 * @property {string} references.table - The referenced table name.
 * @property {string} references.column - The referenced column name.
 * @property {"CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION"} [references.onDelete] - The on delete behavior for foreign key.
 */
export interface ColumnDefinition {
    name: string;
    type: "INTEGER" | "REAL" | "TEXT" | "BLOB" | "BOOLEAN";
    primaryKey?: boolean;
    notNull?: boolean;
    unique?: boolean;
    default?: string | number | boolean | null;
    autoIncrement?: boolean;
    references?: {
        table: string;
        column: string;
        onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
    };
}

export type NewTableArgs = { tableName: string; columns: ColumnDefinition[]; constraints?: string[]; }

