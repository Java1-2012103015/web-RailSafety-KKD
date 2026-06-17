-- CreateTable
CREATE TABLE `FloodAlertRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agencyName` VARCHAR(191) NOT NULL,
    `lineName` VARCHAR(191) NOT NULL,
    `siteName` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `accidentAt` DATETIME(3) NULL,
    `accidentAtText` VARCHAR(191) NULL,
    `rainfallMm` DOUBLE NULL,
    `weatherStationCode` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FloodAlertRecord_agencyName_idx`(`agencyName`),
    INDEX `FloodAlertRecord_lineName_idx`(`lineName`),
    INDEX `FloodAlertRecord_siteName_idx`(`siteName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FloodAlertSetting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `newsKeywords` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
