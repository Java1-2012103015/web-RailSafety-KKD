-- AlterTable
ALTER TABLE `FloodAlertRecord`
    ADD COLUMN `rainfall15mMm` DOUBLE NULL AFTER `rainfallMm`,
    ADD COLUMN `rainfall30mMm` DOUBLE NULL AFTER `rainfall15mMm`,
    ADD COLUMN `rainfall60mMm` DOUBLE NULL AFTER `rainfall30mMm`,
    ADD COLUMN `rainfall360mMm` DOUBLE NULL AFTER `rainfall60mMm`;

-- 기존 사고당시강우량을 60분 강우로 이관
UPDATE `FloodAlertRecord`
SET `rainfall60mMm` = `rainfallMm`
WHERE `rainfall60mMm` IS NULL AND `rainfallMm` IS NOT NULL;
