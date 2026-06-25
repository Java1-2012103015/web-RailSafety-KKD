-- AlterTable
ALTER TABLE `User` ADD COLUMN `selfReportInstitutionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `SelfReportStaff` ADD COLUMN `userId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SelfReportStaff_userId_key` ON `SelfReportStaff`(`userId`);

-- CreateIndex
CREATE INDEX `User_selfReportInstitutionId_idx` ON `User`(`selfReportInstitutionId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_selfReportInstitutionId_fkey` FOREIGN KEY (`selfReportInstitutionId`) REFERENCES `SelfReportInstitution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportStaff` ADD CONSTRAINT `SelfReportStaff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
