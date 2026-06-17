-- CreateTable
CREATE TABLE `RoleMenuActionPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roleId` INTEGER NOT NULL,
    `menuPath` VARCHAR(191) NOT NULL,
    `canRead` BOOLEAN NOT NULL DEFAULT true,
    `canCreate` BOOLEAN NOT NULL DEFAULT false,
    `canUpdate` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoleMenuActionPermission_roleId_idx`(`roleId`),
    INDEX `RoleMenuActionPermission_menuPath_idx`(`menuPath`),
    UNIQUE INDEX `RoleMenuActionPermission_roleId_menuPath_key`(`roleId`, `menuPath`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoleMenuActionPermission` ADD CONSTRAINT `RoleMenuActionPermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
