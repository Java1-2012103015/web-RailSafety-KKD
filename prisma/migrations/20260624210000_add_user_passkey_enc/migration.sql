-- AlterTable
ALTER TABLE `User` ADD COLUMN `passkeyEnc` VARCHAR(191) NULL;

-- 기존 자율보고 패스키 암호화 값 이전
UPDATE `User`
SET `passkeyEnc` = `selfReportAuthKeyEnc`
WHERE `passkeyEnc` IS NULL AND `selfReportAuthKeyEnc` IS NOT NULL;
