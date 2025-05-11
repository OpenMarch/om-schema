import { Database } from "bun:sqlite";
import { Glob } from "bun";

export interface Migration {
    version: number;
    schemaSql: string;
    migrate: (db: Database) => Promise<void> | void;
}
/**
 * Checks if the current database version matches the expected version.
 *
 * @param db The database connection
 * @param version The target version to compare against
 * @returns Boolean indicating if the current database version exactly matches the target version
 * @throws Error if the current database version is higher than the target version
 */
export const IsVersion = (db: Database, version: number) => {
    console.log("------> VERSION CHECK <------");
    const currentVersion = getVersion(db);

    console.log(
        `CHECKING DATABASE VERSION:\n\tcurrent -> ${currentVersion}\n\ttarget -> ${version}`,
    );

    if (currentVersion > version) {
        throw new Error(
            `Database version is higher than the version of this class. Make sure that you are using the highest database version. The database .dots file version is ${currentVersion}, the app thinks the highest version is ${version}`,
        );
    }
    console.log("------> END VERSION CHECK <------");

    return currentVersion === version;
}

/**
 * Retrieves the current user version of the SQLite database.
 *
 * @param database The database connection
 * @returns The current user version number of the database
 * @throws Error if unable to retrieve the database version
 */
export const getVersion = (database: Database): number => {
    const response = database.prepare("PRAGMA user_version").get() as {
        user_version: number;
    };
    if (response === undefined) {
        throw new Error("Failed to get the version of the database.");
    }
    return response.user_version;
}

/**
 * Discovers and validates migration files based on a specified pattern.
 *
 * @param pattern - A glob pattern to search for migration folders (default: "*\/")
 * @returns A promise resolving to an array of validated Migration objects sorted in ascending order by version
 * @throws Error if migration folders or files are invalid or missing
 *
 * This function scans for migration folders, extracts version numbers,
 * validates the presence of schema and migrate files, and ensures
 * migration files have a valid default export function.
 */
export async function getMigrations(pattern = "*/"): Promise<Migration[]> {
    // Discover all migration files matching the pattern
    const glob = new Glob(pattern);
    const migrations: Migration[] = [];
    for await (const path of glob.scan(".")) {
        // Extract version number from folder name
        const version = parseInt(path.split('/')[0]!);
        if (isNaN(version)) {
            throw new Error(`Invalid migration folder name: ${path}`);
        }

        // Check that the SQL file exists
        if (!(await Bun.file(path + "/schema.sql").exists())) {
            throw new Error(`Schema file not found for migration: ${path}`);
        }
        // Check that the migrate file exists
        if (!(await Bun.file(path + "/migrate.ts").exists())) {
            throw new Error(`Migration file not found for migration: ${path}`);
        }
        // Validate that this function has a default export
        const migrate = await import(path + "/migrate.ts");
        if (migrate.default === undefined) {
            throw new Error(`Migration file does not have a default export: ${path}`);
        }
        // Validate that the migration takes a database connection as an argument
        if (migrate.default.length !== 1) {
            throw new Error(`Migration file does not have a single argument: ${path}`);
        }

        const schemaSql = await Bun.file(path + "/schema.sql").text();
        migrations.push({
            version,
            schemaSql,
            migrate: migrate.default
        });
    }

    return migrations.sort((a, b) => a.version - b.version);
}

export default function initDatabase(db: Database, migration: Migration) {
    const version = migration.version
    console.log("Creating tables for version " + version.toString())

    db.exec("PRAGMA user_version = -1");
    db.prepare(migration.schemaSql).run();
    db.exec("PRAGMA user_version = " + version.toString());

}
