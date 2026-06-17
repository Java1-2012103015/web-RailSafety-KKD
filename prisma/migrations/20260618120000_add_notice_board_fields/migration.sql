-- AlterTable
ALTER TABLE `Notice`
    ADD COLUMN `boardType` ENUM('NOTICE', 'ARCHIVE') NOT NULL DEFAULT 'NOTICE',
    ADD COLUMN `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `visible` BOOLEAN NOT NULL DEFAULT true;

-- Backfill postedAt from createdAt for existing rows
UPDATE `Notice` SET `postedAt` = `createdAt` WHERE `postedAt` IS NULL OR `postedAt` = `createdAt`;

-- CreateIndex
CREATE INDEX `Notice_boardType_postedAt_idx` ON `Notice`(`boardType`, `postedAt`);
CREATE INDEX `Notice_visible_idx` ON `Notice`(`visible`);
