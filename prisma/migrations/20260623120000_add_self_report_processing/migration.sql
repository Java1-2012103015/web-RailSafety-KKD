-- CreateTable
CREATE TABLE `SelfReportInstitution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `authKeyHash` VARCHAR(191) NOT NULL,
    `regionalHq` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SelfReportInstitution_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SelfReportStaff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `institutionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `tier` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SelfReportStaff_institutionId_idx`(`institutionId`),
    INDEX `SelfReportStaff_tier_idx`(`tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SelfReportCase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receiptNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `reporterName` VARCHAR(191) NULL,
    `reporterPhone` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `status` ENUM('RECEIVED', 'ADMIN_ASSIGNED', 'TIER1_PROCESSING', 'TIER2_PROCESSING', 'TRANSFERRED', 'COMPLETED', 'CLOSED') NOT NULL DEFAULT 'RECEIVED',
    `institutionId` INTEGER NULL,
    `assigneeStaffId` INTEGER NULL,
    `regionalHq` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SelfReportCase_receiptNumber_key`(`receiptNumber`),
    INDEX `SelfReportCase_status_idx`(`status`),
    INDEX `SelfReportCase_institutionId_idx`(`institutionId`),
    INDEX `SelfReportCase_assigneeStaffId_idx`(`assigneeStaffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SelfReportAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caseId` INTEGER NOT NULL,
    `assignmentType` ENUM('ADMIN_TO_INSTITUTION', 'TIER1_TO_TIER2', 'TIER1_TO_REGIONAL', 'TIER2_TRANSFER') NOT NULL,
    `fromStaffId` INTEGER NULL,
    `toStaffId` INTEGER NULL,
    `toInstitutionId` INTEGER NULL,
    `toRegionalHq` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `adminUserId` INTEGER NULL,
    `smsSent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SelfReportAssignment_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SelfReportHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caseId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `actorName` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SelfReportHistory_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SelfReportStaff` ADD CONSTRAINT `SelfReportStaff_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `SelfReportInstitution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportCase` ADD CONSTRAINT `SelfReportCase_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `SelfReportInstitution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportCase` ADD CONSTRAINT `SelfReportCase_assigneeStaffId_fkey` FOREIGN KEY (`assigneeStaffId`) REFERENCES `SelfReportStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportAssignment` ADD CONSTRAINT `SelfReportAssignment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `SelfReportCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportAssignment` ADD CONSTRAINT `SelfReportAssignment_fromStaffId_fkey` FOREIGN KEY (`fromStaffId`) REFERENCES `SelfReportStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportAssignment` ADD CONSTRAINT `SelfReportAssignment_toStaffId_fkey` FOREIGN KEY (`toStaffId`) REFERENCES `SelfReportStaff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfReportHistory` ADD CONSTRAINT `SelfReportHistory_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `SelfReportCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
