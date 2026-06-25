-- AlterTable
ALTER TABLE `SelfReportCase` ADD COLUMN `processingResultDate` DATETIME(3) NULL,
    ADD COLUMN `processingResultContent` TEXT NULL;

-- AlterTable
ALTER TABLE `SelfReportAttachment` ADD COLUMN `kind` ENUM('CASE', 'RESULT') NOT NULL DEFAULT 'CASE';
