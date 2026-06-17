-- CreateTable
CREATE TABLE `InvestmentDisclosureRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agencyName` VARCHAR(191) NOT NULL,
    `disclosureYear` INTEGER NOT NULL,
    `category1` VARCHAR(191) NOT NULL,
    `category2` VARCHAR(191) NOT NULL,
    `category3` VARCHAR(191) NOT NULL,
    `yearLabel` INTEGER NOT NULL,
    `amountMillion` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvestmentDisclosureRecord_agencyName_idx`(`agencyName`),
    INDEX `InvestmentDisclosureRecord_disclosureYear_idx`(`disclosureYear`),
    INDEX `InvestmentDisclosureRecord_category1_idx`(`category1`),
    INDEX `InvestmentDisclosureRecord_yearLabel_idx`(`yearLabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
