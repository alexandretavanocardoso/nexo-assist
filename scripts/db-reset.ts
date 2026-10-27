// Apaga o banco local e recria com os dados de exemplo (datas relativas a agora).
//   npm run db:reset
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "@/server/db/client";

const file = process.env.DATABASE_PATH ?? "./data/nexo.db";
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${file}${suffix}`, { force: true });
openDatabase(file);
console.log(`Banco recriado com os dados de exemplo em ${path.resolve(file)}`);
