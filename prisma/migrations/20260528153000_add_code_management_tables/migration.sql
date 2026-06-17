CREATE TABLE `InstitutionCode` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `InstitutionCode_code_key`(`code`),
  INDEX `InstitutionCode_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LineCode` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `institutionId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LineCode_code_key`(`code`),
  INDEX `LineCode_institutionId_idx`(`institutionId`),
  INDEX `LineCode_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StationCode` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `lineId` INTEGER NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `StationCode_code_key`(`code`),
  INDEX `StationCode_lineId_idx`(`lineId`),
  INDEX `StationCode_name_idx`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LineCode`
ADD CONSTRAINT `LineCode_institutionId_fkey`
FOREIGN KEY (`institutionId`) REFERENCES `InstitutionCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StationCode`
ADD CONSTRAINT `StationCode_lineId_fkey`
FOREIGN KEY (`lineId`) REFERENCES `LineCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
