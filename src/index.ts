import { Database } from "bun:sqlite";
import * as Migrations from "./migrations";

export interface MigrationOptions {
    dbPath: string;
    dryRun?: boolean;
}

export async function initDatabase(dbPath: string) {
    const migrations = await Migrations.getMigrations();
    const latestMigration = migrations[migrations.length - 1]!;

    const db = new Database(dbPath);
    return Migrations.initDatabase(db, latestMigration);
}

export async function runMigrations(options: MigrationOptions): Promise<void> {
    const { dbPath, dryRun = false } = options;

    const db = new Database(dbPath);
    const currentVersion = Migrations.getVersion(db);

    // Discover all migration files matching the pattern
    const migrations = await Migrations.getMigrations();
    if (!migrations.length) {
        console.error("No migrations found");
        return;
    }
    const latestVersion = migrations[migrations.length - 1]!.version;

    console.log(
        `Current version: ${currentVersion}, Latest version: ${latestVersion}`,
    );

    for (const migration of migrations) {
        if (currentVersion < migration.version) {
            console.log(`Applying v${migration.version}`);

            if (!dryRun) {
                await migration.migrate(db);
            } else {
                console.log(
                    `[DRY RUN] Would apply migration v${migration.version}`,
                );
            }
        }
    }

    console.log(`Migration complete. Database: ${dbPath}`);
    return;
}
