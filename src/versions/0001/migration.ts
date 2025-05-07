import { Database } from "bun:sqlite";
import { Glob } from "bun";

// Discover all migration files matching the pattern
const glob = new Glob("versions/*/migration.ts");
const migrationModules = []
for await (const path of glob.scan(".")) {
    const module = await import(path);
    migrationModules.push(module);
}

const migrations: { version: number; description: string; migrate: (db: Database) => Promise<void> }[] = [];

for (const path in migrationModules) {
    const mod = await migrationModules[path]();
    migrations.push(mod.default);
}

// Sort by version
migrations.sort((a, b) => a.version - b.version);

// Setup DB and migration tracking table
const db = new Database("openmarch.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const appliedVersions = db
    .query("SELECT version FROM migrations")
    .all()
    .map((r) => r.version);

for (const migration of migrations) {
    if (!appliedVersions.includes(migration.version)) {
        console.log(`Applying v${migration.version}: ${migration.description}`);
        await migration.migrate(db);
        db.run("INSERT INTO migrations (version) VALUES (?)", migration.version);
    }
}
