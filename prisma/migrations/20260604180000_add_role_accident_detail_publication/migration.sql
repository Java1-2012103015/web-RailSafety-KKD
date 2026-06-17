-- CreateTable
CREATE TABLE `RoleAccidentDetailPublication` (
    `roleId` INTEGER NOT NULL,
    `visibleColumnKeys` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoleAccidentDetailPublication` ADD CONSTRAINT `RoleAccidentDetailPublication_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
