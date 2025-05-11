// import { writeFileSync, mkdirSync, readdirSync, existsSync, readFileSync } from "fs";
// import { join, dirname } from "path";
// import * as ts from "typescript";
// import { ColumnDefinition } from "../lib/sql/types";

// interface TableSchema {
//     newTableArgs: {
//         tableName: string;
//         columns: ColumnDefinition[];
//         constraints?: string[];
//     };
//     useHistory?: boolean;
// }

// function sqliteTypeToTSType(sqlType: string): string {
//     switch (sqlType) {
//         case "INTEGER":
//         case "REAL":
//         case "BOOLEAN":
//             return "number";
//         case "TEXT":
//             return "string";
//         case "BLOB":
//             return "Uint8Array";
//         default:
//             return "any";
//     }
// }

// function generateInterface(schema: TableSchema): string {
//     const lines = schema.newTableArgs.columns.map(col => {
//         const optional = col.notNull ? "" : "?";
//         const tsType = sqliteTypeToTSType(col.type);
//         return `  ${col.name}${optional}: ${tsType};`;
//     });

//     const interfaceName = schema.newTableArgs.tableName.replace(/[^a-zA-Z0-9]/g, "_");
//     return `export interface ${interfaceName} {\n${lines.join("\n")}\n}`;
// }

// function extractTableSchemasFromFile(filePath: string): TableSchema[] {
//     const schemas: TableSchema[] = [];
//     const fileContent = readFileSync(filePath, 'utf-8');

//     // Parse the TypeScript file
//     const sourceFile = ts.createSourceFile(
//         filePath,
//         fileContent,
//         ts.ScriptTarget.Latest,
//         true
//     );

//     // Visit each node in the AST to find export declarations
//     function visit(node: ts.Node) {
//         if (ts.isVariableStatement(node) &&
//             node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {

//             // Process each variable declaration in the export statement
//             for (const declaration of node.declarationList.declarations) {
//                 if (ts.isIdentifier(declaration.name) && declaration.initializer) {
//                     const tableName = declaration.name.text;
//                     const schema = extractSchemaFromNode(declaration.initializer);

//                     if (schema) {
//                         schemas.push(schema);
//                     }
//                 }
//             }
//         }

//         ts.forEachChild(node, visit);
//     }

//     visit(sourceFile);
//     return schemas;
// }

// function extractSchemaFromNode(node: ts.Node): TableSchema | null {
//     if (!ts.isObjectLiteralExpression(node)) {
//         return null;
//     }

//     let newTableArgs: any = null;
//     let useHistory: boolean | undefined = undefined;

//     for (const property of node.properties) {
//         if (!ts.isPropertyAssignment(property)) continue;

//         if (ts.isIdentifier(property.name) && property.name.text === 'newTableArgs') {
//             newTableArgs = extractNewTableArgs(property.initializer);
//         } else if (ts.isIdentifier(property.name) && property.name.text === 'useHistory') {
//             if (ts.isBooleanLiteral(property.initializer)) {
//                 useHistory = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//             }
//         }
//     }

//     if (newTableArgs) {
//         return {
//             newTableArgs,
//             useHistory
//         };
//     }

//     return null;
// }

// function extractNewTableArgs(node: ts.Node): any {
//     if (!ts.isObjectLiteralExpression(node)) {
//         return null;
//     }

//     let tableName: string | null = null;
//     let columns: ColumnDefinition[] = [];
//     let constraints: string[] | undefined = undefined;

//     for (const property of node.properties) {
//         if (!ts.isPropertyAssignment(property)) continue;

//         if (ts.isIdentifier(property.name)) {
//             if (property.name.text === 'tableName' && ts.isStringLiteral(property.initializer)) {
//                 tableName = property.initializer.text;
//             } else if (property.name.text === 'columns' && ts.isArrayLiteralExpression(property.initializer)) {
//                 columns = extractColumns(property.initializer);
//             } else if (property.name.text === 'constraints' && ts.isArrayLiteralExpression(property.initializer)) {
//                 constraints = extractConstraints(property.initializer);
//             }
//         }
//     }

//     if (tableName && columns.length > 0) {
//         return {
//             tableName,
//             columns,
//             constraints
//         };
//     }

//     return null;
// }

// function extractColumns(node: ts.ArrayLiteralExpression): ColumnDefinition[] {
//     const columns: ColumnDefinition[] = [];

//     for (const element of node.elements) {
//         if (!ts.isObjectLiteralExpression(element)) continue;

//         const column: Partial<ColumnDefinition> = {};

//         for (const property of element.properties) {
//             if (!ts.isPropertyAssignment(property)) continue;

//             if (ts.isIdentifier(property.name)) {
//                 const propName = property.name.text;

//                 if (propName === 'name' && ts.isStringLiteral(property.initializer)) {
//                     column.name = property.initializer.text;
//                 } else if (propName === 'type' && ts.isStringLiteral(property.initializer)) {
//                     column.type = property.initializer.text as any;
//                 } else if (propName === 'notNull' && ts.isBooleanLiteral(property.initializer)) {
//                     column.notNull = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//                 } else if (propName === 'primaryKey' && ts.isBooleanLiteral(property.initializer)) {
//                     column.primaryKey = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//                 } else if (propName === 'autoIncrement' && ts.isBooleanLiteral(property.initializer)) {
//                     column.autoIncrement = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//                 } else if (propName === 'unique' && ts.isBooleanLiteral(property.initializer)) {
//                     column.unique = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//                 } else if (propName === 'default') {
//                     if (ts.isStringLiteral(property.initializer)) {
//                         column.default = property.initializer.text;
//                     } else if (ts.isNumericLiteral(property.initializer)) {
//                         column.default = Number(property.initializer.text);
//                     } else if (ts.isBooleanLiteral(property.initializer)) {
//                         column.default = property.initializer.kind === ts.SyntaxKind.TrueKeyword;
//                     } else if (ts.isNullLiteral(property.initializer)) {
//                         column.default = null;
//                     }
//                 } else if (propName === 'references' && ts.isObjectLiteralExpression(property.initializer)) {
//                     column.references = extractReferences(property.initializer);
//                 }
//             }
//         }

//         if (column.name && column.type) {
//             columns.push(column as ColumnDefinition);
//         }
//     }

//     return columns;
// }

// function extractReferences(node: ts.ObjectLiteralExpression): any {
//     const references: any = {};

//     for (const property of node.properties) {
//         if (!ts.isPropertyAssignment(property)) continue;

//         if (ts.isIdentifier(property.name)) {
//             const propName = property.name.text;

//             if (propName === 'table' && ts.isStringLiteral(property.initializer)) {
//                 references.table = property.initializer.text;
//             } else if (propName === 'column' && ts.isStringLiteral(property.initializer)) {
//                 references.column = property.initializer.text;
//             } else if (propName === 'onDelete' && ts.isStringLiteral(property.initializer)) {
//                 references.onDelete = property.initializer.text;
//             }
//         }
//     }

//     return references;
// }

// function extractConstraints(node: ts.ArrayLiteralExpression): string[] {
//     const constraints: string[] = [];

//     for (const element of node.elements) {
//         if (ts.isStringLiteral(element)) {
//             constraints.push(element.text);
//         }
//     }

//     return constraints;
// }

// function main() {
//     const versionsDir = join(__dirname, "../../versions");

//     if (!existsSync(versionsDir)) {
//         console.error(`❌ Versions directory not found: ${versionsDir}`);
//         return;
//     }

//     // Get all directories in the versions folder
//     const versionFolders = readdirSync(versionsDir, { withFileTypes: true })
//         .filter(dirent => dirent.isDirectory())
//         .map(dirent => dirent.name);

//     let totalInterfaces = 0;

//     for (const folder of versionFolders) {
//         const folderPath = join(versionsDir, folder);
//         const tablesFilePath = join(folderPath, "tables.ts");

//         if (existsSync(tablesFilePath)) {
//             console.log(`Processing ${tablesFilePath}`);

//             // Extract table schemas using TypeScript compiler API
//             const schemas = extractTableSchemasFromFile(tablesFilePath);

//             if (schemas.length === 0) {
//                 console.log(`No table schemas found in ${tablesFilePath}`);
//                 continue;
//             }

//             // Generate interfaces for each schema
//             const interfaces = schemas.map(schema => generateInterface(schema));

//             // Create the interfaces.ts file in the same folder
//             const interfacesFilePath = join(folderPath, "interfaces.ts");
//             writeFileSync(interfacesFilePath, interfaces.join("\n\n"));

//             console.log(`✅ Generated ${interfaces.length} interfaces in ${interfacesFilePath}`);
//             totalInterfaces += interfaces.length;
//         }
//     }

//     console.log(`✅ Total interfaces generated: ${totalInterfaces}`);
// }

// main();
