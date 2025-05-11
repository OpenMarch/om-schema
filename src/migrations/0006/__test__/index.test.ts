import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { Glob } from "bun";
import { Database } from "bun:sqlite";
import { getMigrations, type Migration, } from "../..";

// Mock the Glob class
mock.module("bun", () => {
    return {
        Glob: class MockGlob {
            pattern: string;

            constructor(pattern: string) {
                this.pattern = pattern;
            }

            async *scan(_: string) {
                if (this.pattern === "*/") {
                    yield "0001/migration";
                    yield "0002/migration";
                } else if (this.pattern === "1/") {
                    yield "1/migration";
                } else if (this.pattern === "invalid/") {
                    yield "invalid/migration";
                }
            }
        }
    };
});

// Mock the dynamic imports
const mockMigration1 = {
    default: {
        version: 1,
        schemaSql: "CREATE TABLE test1 (id INTEGER PRIMARY KEY)",
        migrate: () => { }
    } satisfies Migration
};

const mockMigration2 = {
    default: {
        version: 2,
        schemaSql: "CREATE TABLE test2 (id INTEGER PRIMARY KEY)",
        migrate: () => { }
    } satisfies Migration
};

// Mock dynamic import
mock.module("1/migration", () => Promise.resolve(() => mockMigration1));
mock.module("2/migration", () => Promise.resolve(() => mockMigration2));

describe("getMigrations", () => {
    beforeEach(() => {
        // Reset mocks between tests
        mock.restore();
    });

    test("should load migrations from valid directories", async () => {
        const migrations = await getMigrations();

        expect(migrations).toHaveLength(2);
        expect(migrations[0].version).toBe(1);
        expect(migrations[1].version).toBe(2);
        expect(migrations[0].schemaSql).toBe("CREATE TABLE test1 (id INTEGER PRIMARY KEY)");
        expect(migrations[1].schemaSql).toBe("CREATE TABLE test2 (id INTEGER PRIMARY KEY)");
    });

    test("should load migrations with a specific pattern", async () => {
        const migrations = await getMigrations("1/");

        expect(migrations).toHaveLength(1);
        expect(migrations[0].version).toBe(1);
    });

    test("should throw an error for invalid migration folder names", async () => {
        try {
            await getMigrations("invalid/");
            expect(false).toBe(true); // Should not reach here
        } catch (error) {
            expect(error.message).toContain("Invalid migration folder name");
        }
    });

    test("should use default pattern when none is provided", async () => {
        const globSpy = spyOn(Glob.prototype, "constructor");

        await getMigrations();

        expect(globSpy).toHaveBeenCalledWith("*/");
    });
});
