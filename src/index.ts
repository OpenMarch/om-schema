import { Database } from "bun:sqlite";
import { getMigrations, getVersion } from "./migrations";



export interface MigrationOptions {
    dbPath: string;
    dryRun?: boolean;
}


export async function InitDatabase(db: Database) {
    // Find the latest version

}

export async function runMigrations(options: MigrationOptions): Promise<void> {
    const {
        dbPath,
        dryRun = false
    } = options;

    const db = new Database(dbPath);
    const currentVersion = getVersion(db);

    // Discover all migration files matching the pattern
    const migrations = await getMigrations("versions/*/migration.ts");
    if (!migrations.length) {
        console.error("No migrations found");
        return;
    }
    const latestVersion = migrations[migrations.length - 1]!.version;

    console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);

    for (const migration of migrations) {
        if (currentVersion < migration.version) {
            console.log(`Applying v${migration.version}`);

            if (!dryRun) {
                await migration.migrate(db);
            } else {
                console.log(`[DRY RUN] Would apply migration v${migration.version}`);
            }
        }
    }


    console.log(`Migration complete. Database: ${dbPath}`);
    return;
}

