const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../js/accident-db-columns.js"), "utf8");
const keys = [...src.matchAll(/key: "([^"]+)"/g)].map((m) => m[1]);

const INT = new Set([
  "year", "month", "day", "hour", "minute", "deaths", "seriousInjuries", "minorInjuries",
  "carCount", "unitCount", "derailedCars", "damagedCars", "severeDamage", "moderateDamage", "minorDamage",
  "totalDelayedTrains", "highSpeedDelayedTrains", "regularDelayedTrains", "urbanDelayedTrains",
  "dedicatedDelayedTrains", "otherDelayedTrains", "totalDelayMin", "totalDelayMax",
  "highSpeedDelayMin", "highSpeedDelayMax", "regularDelayMin", "regularDelayMax",
  "urbanDelayMin", "urbanDelayMax", "dedicatedDelayMin", "dedicatedDelayMax",
  "otherDelayMin", "otherDelayMax", "relatedPersonCount", "relatedPersonAge",
]);

const DECIMAL = new Set(
  keys.filter((k) => /Amount|Cost|temperature|rainfall|snowfall|visibility|wind|accidentPointKm|speedLimit|accidentSpeed/.test(k)),
);

const TEXT = new Set([
  "facilityDamage", "accidentOverview", "actionContent", "preventionPlan", "siteSituation",
  "nearMissDetail", "delayOperationCauseDetail", "riskIncidentCauseDetail", "rootCauseDetail",
  "primaryCauseOther", "secondaryCauseOther", "riskIncidentDisruptionStatus", "riskIncidentDisruptionCause",
  "nearMissStatus", "nearMissCause", "delayOperationStatus", "delayOperationCause",
]);

let out = `model AccidentDetail {
  id         Int             @id @default(autoincrement())
  accidentId Int             @unique
  accident   RailwayAccident @relation(fields: [accidentId], references: [id], onDelete: Cascade)

`;

for (const k of keys) {
  let type = "String?";
  let extra = "";
  if (INT.has(k)) type = "Int?";
  else if (DECIMAL.has(k)) {
    type = "Decimal?";
    extra = " @db.Decimal(18, 3)";
  } else if (TEXT.has(k)) extra = " @db.Text";
  if (k === "accidentNumber") extra += " @unique";
  out += `  ${k} ${type}${extra}\n`;
}

out += `  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lineName])
}
`;

fs.writeFileSync(path.join(__dirname, "../prisma/accident-detail.model.prisma"), out);
console.log(`Generated AccidentDetail with ${keys.length} fields`);
