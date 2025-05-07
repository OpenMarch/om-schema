import { Database } from "bun:sqlite";
import { UNDO_HISTORY_TABLE_NAME, REDO_HISTORY_TABLE_NAME, HISTORY_STATS_TABLE_NAME } from "./tables";
import type { HistoryStatsRow, HistoryTableRow } from "./tables";

type HistoryType = "undo" | "redo";

/**
 * Response from the history table after performing an undo or redo action.
 */
export type HistoryResponse = {
    /**
     * True if the action was successful.
     */
    success: boolean;
    /**
     * The name of the tables that was modified.
     */
    tableNames: Set<string>;
    /**
     * The SQL statements that were executed to perform the undo or redo action.
     */
    sqlStatements: string[];
    /**
     * The error that occurred when performing the action.
     */
    error?: { message: string; stack: string };
};


/**
 * Creates triggers for a table to record undo/redo history in the database.
 * These actions happen automatically when a row is inserted, updated, or deleted.
 *
 * @param db The database connection
 * @param tableName name of the table to create triggers for
 */
export function createUndoTriggers(db: Database, tableName: string) {
    createTriggers(db, tableName, "undo", true);
}

/**
 * Increment the undo group in the database to create a new group for undo history.
 *
 * This will always return 1 + the max group number in the undo history table.
 *
 * @param db The database connection
 * @returns the new undo group number
 */
export function incrementUndoGroup(db: Database) {
    return incrementGroup(db, "undo");
}

/**
 * Performs an undo action on the database.
 *
 * Undo history is collected based on triggers that are created for each table in the database if desired.
 * Does nothing if there is nothing on the undo stack.
 *
 * @param db the database connection
 * @returns the response from the undo action
 */
export function performUndo(db: Database) {
    return executeHistoryAction(db, "undo");
}

/**
 * Performs redo action on the database.
 *
 * Redo history is collected based on performed undo actions.
 * The redo stack is cleared after a new action is entered into the undo stack.
 * Does nothing if there is nothing on the redo stack.
 *
 * @param db the database connection
 * @returns the response from the redo action
 */
export function performRedo(db: Database) {
    return executeHistoryAction(db, "redo");
}

/**
 * Drops the triggers for a table if they exist. I.e. disables undo tracking for the given table.
 *
 * @param db database connection
 * @param tableName name of the table to drop triggers for
 */
export function dropUndoTriggers(db: Database, tableName: string) {
    db.prepare(`DROP TRIGGER IF EXISTS "${tableName}_it";`).run();
    db.prepare(`DROP TRIGGER IF EXISTS "${tableName}_ut";`).run();
    db.prepare(`DROP TRIGGER IF EXISTS "${tableName}_dt";`).run();
}

/**
 * Increment the group number for either the undo or redo history table.
 *
 * This is done by getting the max group number from the respective history table and incrementing it by 1.
 *
 * @param db database connection
 * @param type "undo" or "redo"
 * @returns The new group number for the respective history table
 */
function incrementGroup(db: Database, type: HistoryType) {
    const historyTableName =
        type === "undo"
            ? UNDO_HISTORY_TABLE_NAME
            : REDO_HISTORY_TABLE_NAME;

    // Get the max group number from the respective history table
    const maxGroup =
        (
            db
                .prepare(
                    `SELECT max("history_group") as current_group FROM ${historyTableName};`,
                )
                .get() as { current_group?: number }
        ).current_group || 0;

    const groupString = type === "undo" ? "cur_undo_group" : "cur_redo_group";
    const newGroup = maxGroup + 1;
    db.prepare(
        `UPDATE ${HISTORY_STATS_TABLE_NAME} SET "${groupString}"=${newGroup};`,
    ).run();

    const groupLimit =
        (
            db
                .prepare(
                    `SELECT group_limit FROM ${HISTORY_STATS_TABLE_NAME};`,
                )
                .get() as HistoryStatsRow
        )?.group_limit || -1;

    // If the group limit is positive and is reached, delete the oldest group
    if (groupLimit > 0) {
        const allGroups = (
            db
                .prepare(
                    `SELECT DISTINCT "history_group" FROM ${historyTableName} ORDER BY "history_group";`,
                )
                .all() as { history_group: number }[]
        ).map((row) => row.history_group);

        if (allGroups.length > groupLimit) {
            // Delete all of the groups that are older than the group limit
            const groupsToDelete = allGroups.slice(
                0,
                allGroups.length - groupLimit,
            );
            for (const group of groupsToDelete) {
                db.prepare(
                    `DELETE FROM ${historyTableName} WHERE "history_group"=${group};`,
                ).run();
            }
        }
    }

    return newGroup;
}

/**
 * Refresh the current both the undo and redo group number in the history stats table
 * to max(group) + 1 of the respective history table.
 *
 * @param db database connection
 * @param type "undo" or "redo"
 */
function refreshCurrentGroups(db: Database) {
    const refreshCurrentGroup = (type: HistoryType) => {
        const tableName =
            type === "undo"
                ? UNDO_HISTORY_TABLE_NAME
                : REDO_HISTORY_TABLE_NAME;
        const groupColumn =
            type === "undo" ? "cur_undo_group" : "cur_redo_group";
        const currentGroup =
            (
                db
                    .prepare(
                        `SELECT max("history_group") as max_group FROM ${tableName};`,
                    )
                    .get() as { max_group: number }
            ).max_group || 0; // default to 0 if there are no rows in the history table

        db.prepare(
            `UPDATE ${HISTORY_STATS_TABLE_NAME} SET "${groupColumn}"=${currentGroup + 1
            };`,
        ).run();
    };

    refreshCurrentGroup("undo");
    refreshCurrentGroup("redo");
}

/**
 * Creates triggers for a table to insert undo/redo history.
 *
 * @param db The database connection
 * @param tableName name of the table to create triggers for
 * @param type either "undo" or "redo"
 * @param deleteRedoRows True if the redo rows should be deleted when inserting new undo rows.
 * This is only used when switching to "undo" mode.
 * The default behavior of the application has this to true so that the redo history is cleared when a new undo action is inserted.
 * It should be false when a redo is being performed and there are triggers inserting into the undo table.
 */
function createTriggers(
    db: Database,
    tableName: string,
    type: HistoryType,
    deleteRedoRows: boolean = true,
) {
    const columns = db
        .prepare(`SELECT name FROM pragma_table_info('${tableName}');`)
        .all() as { name: string }[];

    const historyTableName =
        type === "undo"
            ? UNDO_HISTORY_TABLE_NAME
            : REDO_HISTORY_TABLE_NAME;
    const groupColumn = type === "undo" ? "cur_undo_group" : "cur_redo_group";
    const currentGroup = (
        db
            .prepare(
                `SELECT ${groupColumn} as current_group
                FROM ${HISTORY_STATS_TABLE_NAME};`,
            )
            .get() as { current_group: number }
    ).current_group;
    if (currentGroup === undefined) {
        console.error(
            "Could not get current group number from history stats table",
        );
        return;
    }

    // When the triggers are in undo mode, we need to delete all of the items from the redo table once an item is entered in the redo table
    const sideEffect =
        type === "undo" && deleteRedoRows
            ? `DELETE FROM ${REDO_HISTORY_TABLE_NAME};
            UPDATE ${HISTORY_STATS_TABLE_NAME} SET "cur_redo_group" = 0;`
            : "";

    // Drop the triggers if they already exist
    dropUndoTriggers(db, tableName);

    // INSERT trigger
    let sqlStmt = `CREATE TRIGGER IF NOT EXISTS "${tableName}_it" AFTER INSERT ON "${tableName}" BEGIN
        INSERT INTO ${historyTableName} ("sequence" , "history_group", "sql")
            VALUES(NULL, (SELECT ${groupColumn} FROM history_stats), 'DELETE FROM "${tableName}" WHERE rowid='||new.rowid);
        ${sideEffect}
    END;`;
    db.prepare(sqlStmt).run();
    // UPDATE trigger
    sqlStmt = `CREATE TRIGGER IF NOT EXISTS "${tableName}_ut" AFTER UPDATE ON "${tableName}" BEGIN
        INSERT INTO ${historyTableName} ("sequence" , "history_group", "sql")
            VALUES(NULL, (SELECT ${groupColumn} FROM history_stats), 'UPDATE "${tableName}" SET ${columns
            .map((c) => `"${c.name}"='||quote(old."${c.name}")||'`)
            .join(",")} WHERE rowid='||old.rowid);
        ${sideEffect}
    END;`;
    db.prepare(sqlStmt).run();
    // DELETE trigger
    sqlStmt = `CREATE TRIGGER IF NOT EXISTS "${tableName}_dt" BEFORE DELETE ON "${tableName}" BEGIN
          INSERT INTO ${historyTableName} ("sequence" , "history_group", "sql")
            VALUES(NULL, (SELECT ${groupColumn} FROM history_stats), 'INSERT INTO "${tableName}" (${columns
            .map((column) => `"${column.name}"`)
            .join(",")}) VALUES (${columns
                .map((c) => `'||quote(old."${c.name}")||'`)
                .join(",")})');
          ${sideEffect}
      END;`;
    db.prepare(sqlStmt).run();
}

/**
 * Switch the triggers to either undo or redo mode.
 * This is so when performing an undo action, the redo history is updated and vice versa.
 *
 * @param db The database connection
 * @param mode The mode to switch to, either "undo" or "redo"
 * @param deleteRedoRows true if the redo rows should be deleted when inserting new undo rows.
 */
const switchTriggerMode = (
    db: Database,
    mode: HistoryType,
    deleteRedoRows: boolean,
    tableNames?: Set<string>,
) => {
    console.log(`------ Switching triggers to ${mode} mode ------`);
    let sql = `SELECT * FROM sqlite_master WHERE type='trigger' AND ("name" LIKE '%$_ut' ESCAPE '$' OR "name" LIKE  '%$_it' ESCAPE '$' OR "name" LIKE  '%$_dt' ESCAPE '$')`;
    if (tableNames) {
        sql += ` AND tbl_name IN (${Array.from(tableNames)
            .map((t) => `'${t}'`)
            .join(",")})`;
    }
    sql += ";";
    // TODO TEST THIS
    const triggers = db.prepare(sql).all() as {
        name: string;
        tbl_name: string;
    }[];
    const tables = new Set(triggers.map((t) => t.tbl_name));
    for (const trigger of triggers) {
        db.prepare(`DROP TRIGGER IF EXISTS ${trigger.name};`).run();
    }
    for (const table of tables) {
        createTriggers(db, table, mode, deleteRedoRows);
    }
    console.log(`------ Done switching triggers to ${mode} mode ------`);
};

/**
 * Performs an undo or redo action on the database.
 *
 * Undo/redo history is collected based on triggers that are created for each table in the database if desired.
 *
 * @param db the database connection
 * @param type either "undo" or "redo"
 */
function executeHistoryAction(
    db: Database,
    type: HistoryType,
): HistoryResponse {
    console.log(`\n============ PERFORMING ${type.toUpperCase()} ============`);
    let response: HistoryResponse = {
        success: false,
        tableNames: new Set(),
        sqlStatements: [],
        error: { message: "No error to show", stack: "No stack to show" },
    };
    let sqlStatements: string[] = [];
    try {
        const tableName =
            type === "undo"
                ? UNDO_HISTORY_TABLE_NAME
                : REDO_HISTORY_TABLE_NAME;
        let currentGroup = (
            db
                .prepare(
                    `SELECT max("history_group") as max_group FROM ${tableName};`,
                )
                .get() as { max_group: number }
        ).max_group;

        // Get all of the SQL statements in the current undo group
        const getSqlStatements = (group: number) =>
            (
                db
                    .prepare(
                        `SELECT sql FROM
                ${type === "undo"
                            ? UNDO_HISTORY_TABLE_NAME
                            : REDO_HISTORY_TABLE_NAME
                        }
                WHERE "history_group"=${group} ORDER BY sequence DESC;`,
                    )
                    .all() as HistoryTableRow[]
            ).map((row) => row.sql);

        sqlStatements = getSqlStatements(currentGroup);
        if (sqlStatements.length === 0) {
            console.log("No actions to " + type);
            return {
                success: true,
                tableNames: new Set(),
                sqlStatements: [],
            };
        }

        const tableNames = new Set<string>();
        for (const sql of sqlStatements) {
            const tableName = sql.match(/"(.*?)"/)?.[0].replaceAll('"', "");
            if (tableName) {
                tableNames.add(tableName);
            }
        }

        if (type === "undo") {
            // Switch the triggers to redo mode so that the redo history is updated
            incrementGroup(db, "redo");
            switchTriggerMode(db, "redo", false, tableNames);
        } else {
            // Switch the triggers so that the redo table does not have its rows deleted
            switchTriggerMode(db, "undo", false, tableNames);
        }

        // Temporarily disable foreign key checks
        db.prepare("PRAGMA foreign_keys = OFF;").run();

        /// Execute all of the SQL statements in the current history group
        for (const sqlStatement of sqlStatements) {
            db.prepare(sqlStatement).run();
        }

        // Re-enable foreign key checks
        db.prepare("PRAGMA foreign_keys = ON;").run();

        // Delete all of the SQL statements in the current undo group
        db.prepare(
            `DELETE FROM ${tableName} WHERE "history_group"=${currentGroup};`,
        ).run();

        // Refresh the current group number in the history stats table
        refreshCurrentGroups(db);

        // Switch the triggers back to undo mode and delete the redo rows when inputting new undo rows
        switchTriggerMode(db, "undo", true, tableNames);
        response = {
            success: true,
            tableNames,
            sqlStatements,
        };
    } catch (err: any) {
        console.error(err);
        response = {
            success: false,
            tableNames: new Set(),
            sqlStatements: [],
            error: {
                message: err?.message || "failed to get error",
                stack: err?.stack || "Failed to get stack",
            },
        };
    } finally {
        console.log(
            `============ FINISHED ${type.toUpperCase()} =============\n`,
        );
    }

    return response;
}

/**
 * Clear the most recent redo actions from the most recent group.
 *
 * This should be used when there was an error that required changes to be
 * rolled back but the redo history should not be kept.
 *
 * @param db database connection
 */
export function clearMostRecentRedo(db: Database) {
    console.log(`-------- Clearing most recent redo --------`);
    const maxGroup = (
        db
            .prepare(
                `SELECT MAX(history_group) as max_redo_group FROM ${REDO_HISTORY_TABLE_NAME}`,
            )
            .get() as { max_redo_group: number }
    ).max_redo_group;
    db.prepare(
        `DELETE FROM ${REDO_HISTORY_TABLE_NAME} WHERE history_group = ?`,
    ).run(maxGroup);
    console.log(`-------- Done clearing most recent redo --------`);
}

/**
 * @param db database connection
 * @returns The current undo group number in the history stats table
 */
export function getCurrentUndoGroup(db: Database) {
    return (
        db
            .prepare(
                `SELECT cur_undo_group FROM ${HISTORY_STATS_TABLE_NAME};`,
            )
            .get() as { cur_undo_group: number }
    ).cur_undo_group;
}

/**
 * @param db database connection
 * @returns The current redo group number in the history stats table
 */
export function getCurrentRedoGroup(db: Database) {
    return (
        db
            .prepare(
                `SELECT cur_redo_group FROM ${HISTORY_STATS_TABLE_NAME};`,
            )
            .get() as { cur_redo_group: number }
    ).cur_redo_group;
}

/**
 * Decrement all of the undo actions in the most recent group down by one.
 *
 * This should be used when a database action should not create its own group, but the group number
 * was incremented to allow for rolling back changes due to error.
 *
 * @param db database connection
 */
export function decrementLastUndoGroup(db: Database) {
    console.log(`-------- Decrementing last undo group --------`);
    const maxGroup = (
        db
            .prepare(
                `SELECT MAX(history_group) as max_undo_group FROM ${UNDO_HISTORY_TABLE_NAME}`,
            )
            .get() as { max_undo_group: number }
    ).max_undo_group;

    const previousGroup = (
        db
            .prepare(
                `SELECT MAX(history_group) as previous_group FROM ${UNDO_HISTORY_TABLE_NAME} WHERE history_group < ?`,
            )
            .get(maxGroup) as { previous_group: number }
    ).previous_group;

    if (previousGroup) {
        db.prepare(
            `UPDATE ${UNDO_HISTORY_TABLE_NAME} SET history_group = ? WHERE history_group = ?`,
        ).run(previousGroup, maxGroup);
        db.prepare(
            `UPDATE ${HISTORY_STATS_TABLE_NAME} SET cur_undo_group = ?`,
        ).run(previousGroup);
    }
    console.log(`-------- Done decrementing last undo group --------`);
}

/**
 * Flatten all of the undo groups above the given group number.
 *
 * This is used when subsequent undo groups are created, but they should be part of the same group.
 *
 * @param db database connection
 * @param group the group number to flatten above
 */
export function flattenUndoGroupsAbove(db: Database, group: number) {
    console.log(`-------- Flattening undo groups above ${group} --------`);
    db.prepare(
        `UPDATE ${UNDO_HISTORY_TABLE_NAME} SET history_group = ? WHERE history_group > ?`,
    ).run(group, group);
    console.log(`-------- Done flattening undo groups above ${group} --------`);
}

/**
 * Calculate the size of the undo and redo history tables in bytes.
 *
 * @param db database connection
 * @returns the size of the undo and redo history tables in bytes
 */
/**
 * Calculate the approximate size of the undo and redo history tables in bytes.
 * This method estimates size based on row count and average row size.
 *
 * @param db database connection
 * @returns the estimated size of the undo and redo history tables in bytes
 */
export function calculateHistorySize(db: Database) {
    // Get average SQL statement length
    const getSqlLength = (tableName: string): number => {
        const rows = db
            .prepare(`SELECT sql FROM ${tableName}`)
            .all() as HistoryTableRow[];

        if (rows.length === 0) return 0;

        const totalLength = rows.reduce((sum, row) => sum + row.sql.length, 0);
        return totalLength;
    };

    const undoAvgLength = getSqlLength(UNDO_HISTORY_TABLE_NAME);
    const redoAvgLength = getSqlLength(REDO_HISTORY_TABLE_NAME);

    // Estimate size: row count * (avg SQL length + overhead for other columns)
    // Assuming 2 bytes per character for SQL
    const undoSize = undoAvgLength * 2;
    const redoSize = redoAvgLength * 2;

    return undoSize + redoSize;
}
