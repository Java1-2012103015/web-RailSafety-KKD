-- AlterTable
ALTER TABLE `FloodAlertRecord` ADD COLUMN `accidentNumber` VARCHAR(191) NULL;

UPDATE `FloodAlertRecord` SET `accidentNumber` = CONCAT('FLD-LEGACY-', `id`) WHERE `accidentNumber` IS NULL;

ALTER TABLE `FloodAlertRecord` MODIFY `accidentNumber` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `FloodAlertRecord_accidentNumber_key` ON `FloodAlertRecord`(`accidentNumber`);
