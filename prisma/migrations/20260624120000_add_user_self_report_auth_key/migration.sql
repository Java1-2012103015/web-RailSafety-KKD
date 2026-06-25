-- AlterTable
ALTER TABLE `User` ADD COLUMN `selfReportAuthKeyHash` VARCHAR(191) NULL;

-- Backfill: 기존 자율보고 사용자는 계정 비밀번호를 인증키로 사용
UPDATE `User` u
INNER JOIN `Role` r ON u.`roleId` = r.`id`
SET u.`selfReportAuthKeyHash` = u.`password`
WHERE r.`name` IN ('SELF_REPORT_TIER1', 'SELF_REPORT_TIER2')
  AND u.`selfReportAuthKeyHash` IS NULL;
