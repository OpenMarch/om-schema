
/**
 * Migrates the database from the previous version to this version
 *
 * @param db
 */
export default function migrate(db: Database) {
    const version = db.prepare('PRAGMA user_version').pluck().get() as number;
    if (version !== 5) {
        throw new Error(`Expected user_version 5, got ${version}`);
    }

}
