-- AlterTable
ALTER TABLE `Ticket` ADD COLUMN `aiSimilarTicketIds` VARCHAR(191) NULL,
    ADD COLUMN `aiSummary` TEXT NULL;
