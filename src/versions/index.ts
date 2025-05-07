import { Database } from "bun:sqlite"
import type { TableSchema } from "./types"
import { createTableSQL } from "../lib/sql/generate";

/**
 * Creates a table in the database based on the provided schema.
 *
 * @param db - The SQLite database instance
 * @param schema - The schema definition for the table to be created
 * @throws {Error} If pre-create or post-create hooks fail
 */
export const createTable = (db: Database, schema: TableSchema) => {
    const { newTableArgs } = schema;
    const { tableName } = newTableArgs;

    const sql = createTableSQL(newTableArgs);
    const preCreateSuccess = schema.preCreate ? schema.preCreate(db) : true;
    if (!preCreateSuccess) {
        throw new Error("Pre-create hook failed. Cancelling creation of table " + tableName);
    }
    db.prepare(sql).run();
    const postCreateSuccess = schema.postCreate ? schema.postCreate(db) : true;
    if (!postCreateSuccess) {
        throw new Error("Post-create hook failed. Cancelling creation of table " + tableName);
    }

}
