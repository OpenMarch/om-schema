import type { NewTableArgs } from "../lib/sql/types"
import { Database } from "bun:sqlite"

/**
 * Represents the schema for a database version, including its version number, description, and table models.
 */
export interface DatabaseVersionSchema {
    /**
     * The version number of this database.
     */
    versionNumber: number;
    /**
     * A description of the version.
     */
    description?: string;
    /**
     * The schemas for the tables in the version
     */
    models: TableSchema[];

    migrationFunction: (db: Database) => boolean;
}

export interface TableSchema {
    /**
     * SQL query to create the table
     */
    newTableArgs: NewTableArgs,
    /**
     * Function to run before the table is created.
     *
     * @returns true if successful, false to abort creation
     */
    preCreate?: (db: Database) => boolean,
    /**
     * Function to run after the table is created.
     *
     * @returns true if successful, false to abort creation
     */
    postCreate?: (db: Database) => boolean,
    /**
     * Whether to use the history system for this table.
     */
    useHistory: boolean

}
