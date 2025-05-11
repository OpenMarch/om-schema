CREATE TABLE history_undo (
        "sequence" INTEGER PRIMARY KEY,
        "history_group" INTEGER NOT NULL,
        "sql" TEXT NOT NULL
    )
CREATE TABLE history_redo (
        "sequence" INTEGER PRIMARY KEY,
        "history_group" INTEGER NOT NULL,
        "sql" TEXT NOT NULL
    )
CREATE TABLE history_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cur_undo_group INTEGER NOT NULL,
        cur_redo_group INTEGER NOT NULL,
        group_limit INTEGER NOT NULL
    )
CREATE TABLE "marchers" (
                "id"	        INTEGER PRIMARY KEY,
                "name"	        TEXT,
                "section"	    TEXT NOT NULL,
                "year"	        TEXT,
                "notes"	        TEXT,
                "drill_prefix"	TEXT NOT NULL,
                "drill_order"	INTEGER NOT NULL,
                "created_at"	TEXT NOT NULL,
                "updated_at"	TEXT NOT NULL,
                UNIQUE ("drill_prefix", "drill_order")
            )
CREATE TABLE "pages" (
                "id"	            INTEGER PRIMARY KEY,
                "is_subset"	        INTEGER NOT NULL DEFAULT 0 CHECK (is_subset IN (0, 1)),
                "notes"	            TEXT,
                "counts"	        INTEGER NOT NULL CHECK (counts >= 0),
                "created_at"	    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at"	    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "next_page_id"	    INTEGER,
                FOREIGN KEY ("next_page_id") REFERENCES "pages" ("id")
                )
CREATE TABLE "marcher_pages" (
                "id"            INTEGER PRIMARY KEY,
                "id_for_html"   TEXT UNIQUE,
                "marcher_id"    INTEGER NOT NULL,
                "page_id"       INTEGER NOT NULL,
                "x"             REAL,
                "y"             REAL,
                "created_at"    TEXT NOT NULL,
                "updated_at"    TEXT NOT NULL,
                "notes"         TEXT,
                FOREIGN KEY ("marcher_id") REFERENCES "marchers" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
                FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
                UNIQUE ("marcher_id", "page_id")
            )
CREATE INDEX "index_marcher_pages_on_marcher_id" ON "marcher_pages" ("marcher_id")
CREATE INDEX "index_marcher_pages_on_page_id" ON "marcher_pages" ("page_id")
CREATE TABLE "field_properties" (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    json_data TEXT NOT NULL,
                    image BLOB
                )
CREATE TABLE "measures" (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    abc_data TEXT,
                    "created_at"	TEXT NOT NULL,
                    "updated_at"	TEXT NOT NULL
                )
CREATE TABLE "audio_files" (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL,
                nickname TEXT,
                data BLOB,
                selected INTEGER NOT NULL DEFAULT 0,
                "created_at"	TEXT NOT NULL,
                "updated_at"	TEXT NOT NULL
            )
CREATE TABLE "shapes" (
                "id"            INTEGER PRIMARY KEY,
                "name"          TEXT,
                "created_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "notes"         TEXT
            )
CREATE TABLE "shape_pages" (
                "id"            INTEGER PRIMARY KEY,
                "shape_id"      INTEGER NOT NULL,
                "page_id"       INTEGER NOT NULL,
                "svg_path"      TEXT NOT NULL,
                "created_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at"    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "notes"         TEXT,
                FOREIGN KEY (shape_id) REFERENCES "shapes" ("id") ON DELETE CASCADE,
                FOREIGN KEY (page_id) REFERENCES "pages" ("id") ON DELETE CASCADE,
                UNIQUE (shape_id, page_id)
            )
CREATE TABLE "shape_page_marchers" (
                "id"                INTEGER PRIMARY KEY,
                "shape_page_id"     INTEGER NOT NULL REFERENCES "shape_pages" ("id"),
                "marcher_id"        INTEGER NOT NULL REFERENCES "marchers" ("id"),
                "position_order"    INTEGER,
                "created_at"        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at"        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "notes"             TEXT,
                FOREIGN KEY (shape_page_id) REFERENCES "shape_pages" ("id") ON DELETE CASCADE,
                FOREIGN KEY (marcher_id) REFERENCES "marchers" ("id") ON DELETE CASCADE,
                UNIQUE (shape_page_id, position_order),
                UNIQUE (shape_page_id, marcher_id)
            )
CREATE INDEX "idx-spm-shape_page_id" ON "shape_page_marchers" (shape_page_id)
CREATE INDEX "idx-spm-marcher_id" ON "shape_page_marchers" (marcher_id)
