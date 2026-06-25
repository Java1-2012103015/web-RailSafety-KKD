-- CreateTable
CREATE TABLE `SelfReportAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caseId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SelfReportAttachment_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SelfReportAttachment` ADD CONSTRAINT `SelfReportAttachment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `SelfReportCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
