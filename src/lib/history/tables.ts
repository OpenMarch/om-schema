import { Database } from "bun:sqlite";

export const UNDO_HISTORY_TABLE_NAME = "history_undo";
export const REDO_HISTORY_TABLE_NAME = "history_redo";
export const HISTORY_STATS_TABLE_NAME = "history_stats";


/**
 * A row in the history stats table.
 */
export type HistoryStatsRow = {
    /** useless id */
    readonly id: 1;
    /**
     * The current undo group the undo stack is on.
     * When adding a new records to the undo table, this number is used to group the records together.
     *
     * To separate different undo groups, increment this number.
     * It is automatically decremented when performing an undo action.
     */
    cur_undo_group: number;
    /**
     * The current redo group the undo stack is on.
     * When adding a new records to the redo table, this number is used to group the records together.
     *
     * This should never be adjusted manually.
     * It is automatically incremented/decremented automatically when performing an undo action.
     */
    cur_redo_group: number;
    /**
     * The maximum number of undo groups to keep in the history table.
     *
     * If this number is positive, the oldest undo group is deleted when the number of undo groups exceeds this limit.
     * If this number is negative, there is no limit to the number of undo groups.
     */
    group_limit: number;
};

/**
 * A row in the undo or redo history table.
 */
export type HistoryTableRow = {
    /**
     * The sequence number of the action in the history table.
     * Primary key of the table.
     */
    sequence: number;
    /**
     * The group number of the action in the history table.
     * This is used to group actions together and is taken from the history stats table.
     *
     * To separate different groups of actions, increment the number in the history stats table.
     */
    history_group: number;
    /**
     * The SQL statement to undo or redo the action.
     */
    sql: string;
};

/**
 * Creates the tables to track history in the database
 *
 * @param db The database connection
 */
export function createHistoryTables(db: Database) {
    const sqlStr = (tableName: string) => `
    CREATE TABLE ${tableName} (
        "sequence" INTEGER PRIMARY KEY,
        "history_group" INTEGER NOT NULL,
        "sql" TEXT NOT NULL
    );`;

    db.prepare(sqlStr(UNDO_HISTORY_TABLE_NAME)).run();
    db.prepare(sqlStr(REDO_HISTORY_TABLE_NAME)).run();

    db.prepare(
        `CREATE TABLE ${HISTORY_STATS_TABLE_NAME} (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cur_undo_group INTEGER NOT NULL,
        cur_redo_group INTEGER NOT NULL,
        group_limit INTEGER NOT NULL
    );`,
    ).run();
    db.prepare(
        `INSERT OR IGNORE INTO ${HISTORY_STATS_TABLE_NAME}
        (id, cur_undo_group, cur_redo_group, group_limit) VALUES (1, 0, 0, 500);`,
    ).run();
}
