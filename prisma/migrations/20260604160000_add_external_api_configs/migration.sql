CREATE TABLE `ExternalApiConfig` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `apiType` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `endpointUrl` VARCHAR(191) NULL,
  `apiKey` TEXT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ExternalApiConfig_apiType_key`(`apiType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
