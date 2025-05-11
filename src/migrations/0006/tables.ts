
import type { Database } from "bun:sqlite";
import type { DatabaseVersionSchema, TableSchema } from "../types";
import { createTable } from "..";

// Constants that match the original code
const Constants = {
    MarcherTableName: "marchers",
    PageTableName: "pages",
    MarcherPageTableName: "marcher_pages",
    FieldPropertiesTableName: "field_properties",
    MeasureTableName: "measures",
    AudioFilesTableName: "audio_files"
};

// Define table schemas
const marcherTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.MarcherTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
            { name: "name", type: "TEXT" },
            { name: "section", type: "TEXT", notNull: true },
            { name: "year", type: "TEXT" },
            { name: "notes", type: "TEXT" },
            { name: "drill_prefix", type: "TEXT", notNull: true },
            { name: "drill_order", type: "INTEGER", notNull: true },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ],
        constraints: [
            `UNIQUE ("drill_prefix", "drill_order")`
        ]
    },
    useHistory: true
};

const pageTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.PageTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
            { name: "is_subset", type: "INTEGER", notNull: true, default: 0 },
            { name: "notes", type: "TEXT" },
            { name: "counts", type: "INTEGER", notNull: true },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" },
            {
                name: "next_page_id",
                type: "INTEGER",
                references: {
                    table: Constants.PageTableName,
                    column: "id"
                }
            }
        ],
        constraints: [
            `CHECK (is_subset IN (0, 1))`,
            `CHECK (counts >= 0)`
        ]
    },
    postCreate: (db: Database) => {
        // Create page 1 with 0 counts
        db.prepare(`INSERT INTO ${Constants.PageTableName} ("counts", "id") VALUES (0, 0)`).run();
    },
    useHistory: true
};

const marcherPageTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.MarcherPageTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
            { name: "id_for_html", type: "TEXT", unique: true },
            {
                name: "marcher_id",
                type: "INTEGER",
                notNull: true,
                references: {
                    table: Constants.MarcherTableName,
                    column: "id",
                    onDelete: "CASCADE"
                }
            },
            {
                name: "page_id",
                type: "INTEGER",
                notNull: true,
                references: {
                    table: Constants.PageTableName,
                    column: "id",
                    onDelete: "CASCADE"
                }
            },
            { name: "x", type: "REAL" },
            { name: "y", type: "REAL" },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" },
            { name: "notes", type: "TEXT" }
        ],
        constraints: [
            `UNIQUE ("marcher_id", "page_id")`
        ]
    },
    preCreate: () => { },
    postCreate: (db: Database) => {
        // Create indexes
        db.exec(`CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_marcher_id" ON "${Constants.MarcherPageTableName}" ("marcher_id")`);
        db.exec(`CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_page_id" ON "${Constants.MarcherPageTableName}" ("page_id")`);
    },
    useHistory: true
};

const fieldPropertiesTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.FieldPropertiesTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "json_data", type: "TEXT" }
        ],
        constraints: [
            `CHECK (id = 1)`
        ]
    },
    preCreate: () => { },
    postCreate: (db: Database) => {
        // Insert default field properties
        const defaultFieldProperties = {
            // Default high school football field properties
            width: 160,
            height: 84,
            hashMarkYards: 32,
            endZoneWidth: 0,
            yardsBetweenHashes: 53.33,
            yardLineCount: 20
        };

        db.prepare(`INSERT INTO ${Constants.FieldPropertiesTableName} (id, json_data) VALUES (1, ?)`).run(
            JSON.stringify(defaultFieldProperties)
        );
    },
    useHistory: true
};

const measureTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.MeasureTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true },
            { name: "abc_data", type: "TEXT" },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ],
        constraints: [
            `CHECK (id = 1)`
        ]
    },
    postCreate: (db: Database) => {
        // Insert default measure
        const defaultMeasure = `X:1Q:1/4=120M:4/4V:1 baritoneV:1z4 | z4 | z4 | z4 | z4 | z4 | z4 | z4 |`;
        const created_at = new Date().toISOString();

        db.prepare(`INSERT INTO ${Constants.MeasureTableName} (id, abc_data, created_at, updated_at) VALUES (1, ?, ?, ?)`).run(
            defaultMeasure,
            created_at,
            created_at
        );
    },
    useHistory: true
};

const audioFilesTableSchema: TableSchema = {
    newTableArgs: {
        tableName: Constants.AudioFilesTableName,
        columns: [
            { name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true },
            { name: "path", type: "TEXT", notNull: true },
            { name: "nickname", type: "TEXT" },
            { name: "data", type: "BLOB" },
            { name: "selected", type: "INTEGER", notNull: true, default: 0 },
            { name: "created_at", type: "TEXT" },
            { name: "updated_at", type: "TEXT" }
        ]
    },
    useHistory: true
};

// Define the database version schema
export const databaseVersionSchema: DatabaseVersionSchema = {
    versionNumber: 1,
    description: "Initial database schema for OpenMarch",
    models: [
        marcherTableSchema,
        pageTableSchema,
        marcherPageTableSchema,
        fieldPropertiesTableSchema,
        measureTableSchema,
        audioFilesTableSchema
    ],
    migrationFunction: (db: Database) => {
        try {
            // Create all tables
            for (const tableSchema of databaseVersionSchema.models)
                createTable(db, tableSchema);

            return true;
        } catch (error) {
            console.error("Migration failed:", error);
            return false;
        }
    },
};

export default databaseVersionSchema;
