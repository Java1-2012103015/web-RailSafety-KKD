-- AlterTable
ALTER TABLE `User` ADD COLUMN `ipRestrictionEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `allowedIp` VARCHAR(191) NULL;
