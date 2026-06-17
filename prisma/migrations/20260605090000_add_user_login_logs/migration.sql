-- CreateTable
CREATE TABLE `UserLoginLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `roleName` VARCHAR(191) NULL,
    `status` ENUM('SUCCESS', 'FAILURE') NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `failReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserLoginLog_userId_idx`(`userId`),
    INDEX `UserLoginLog_email_idx`(`email`),
    INDEX `UserLoginLog_createdAt_idx`(`createdAt`),
    INDEX `UserLoginLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserLoginLog` ADD CONSTRAINT `UserLoginLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
