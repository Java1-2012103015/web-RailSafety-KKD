-- CreateTable
CREATE TABLE `RoleBranding` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roleId` INTEGER NULL,
    `pageTitle` VARCHAR(191) NOT NULL DEFAULT '철도안전정보종합관리시스템',
    `systemName` VARCHAR(191) NOT NULL DEFAULT '철도안전정보종합관리시스템',
    `heroTitle` VARCHAR(191) NULL,
    `heroSubtitle` TEXT NULL,
    `showLogo` BOOLEAN NOT NULL DEFAULT false,
    `logoUrl` VARCHAR(191) NULL,
    `showCiMark` BOOLEAN NOT NULL DEFAULT false,
    `ciMarkLabel` VARCHAR(191) NULL,
    `showHero` BOOLEAN NOT NULL DEFAULT true,
    `showFooter` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RoleBranding_roleId_key`(`roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoleBranding` ADD CONSTRAINT `RoleBranding_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
