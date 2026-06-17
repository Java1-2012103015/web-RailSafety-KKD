-- CreateTable
CREATE TABLE `UserPageUsageLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `roleName` VARCHAR(191) NULL,
    `path` VARCHAR(191) NOT NULL,
    `pageTitle` VARCHAR(191) NULL,
    `sessionKey` VARCHAR(191) NOT NULL,
    `dwellSeconds` INTEGER NOT NULL DEFAULT 0,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `UserPageUsageLog_sessionKey_key`(`sessionKey`),
    INDEX `UserPageUsageLog_userId_idx`(`userId`),
    INDEX `UserPageUsageLog_email_idx`(`email`),
    INDEX `UserPageUsageLog_path_idx`(`path`),
    INDEX `UserPageUsageLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserPageUsageLog` ADD CONSTRAINT `UserPageUsageLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
