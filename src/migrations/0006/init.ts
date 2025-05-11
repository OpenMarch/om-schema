import { Database } from "bun:sqlite"
import schemaSQL from './schema.sql';
import path from 'path';
export default function InitDatabase(db: Database) {
    const version = parseInt(path.basename(__dirname));
    console.log("Creating tables for version " + version.toString())

    db.exec("PRAGMA user_version = -1");
    db.prepare(schemaSQL).run();
    db.exec("PRAGMA user_version = " + version.toString());

}
