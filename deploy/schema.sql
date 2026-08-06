-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `googleId` VARCHAR(191) NOT NULL,
    `avatarColor` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_googleId_key`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clubs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `inviteCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clubs_inviteCode_key`(`inviteCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `club_members` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clubId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SCORER', 'PLAYER') NOT NULL DEFAULT 'PLAYER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `club_members_userId_clubId_key`(`userId`, `clubId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `players` (
    `id` VARCHAR(191) NOT NULL,
    `clubId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('BATSMAN', 'BOWLER', 'ALL_ROUNDER') NOT NULL DEFAULT 'ALL_ROUNDER',
    `battingRating` DOUBLE NOT NULL DEFAULT 50.0,
    `bowlingRating` DOUBLE NOT NULL DEFAULT 50.0,
    `overallRating` DOUBLE NOT NULL DEFAULT 50.0,
    `isRatingManual` BOOLEAN NOT NULL DEFAULT false,
    `linkedUserId` VARCHAR(191) NULL,
    `avatarColor` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `series` (
    `id` VARCHAR(191) NOT NULL,
    `clubId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matches` (
    `id` VARCHAR(191) NOT NULL,
    `clubId` VARCHAR(191) NOT NULL,
    `seriesId` VARCHAR(191) NULL,
    `totalOvers` INTEGER NOT NULL,
    `teamAName` VARCHAR(191) NOT NULL DEFAULT 'Team A',
    `teamBName` VARCHAR(191) NOT NULL DEFAULT 'Team B',
    `tossWinner` ENUM('TEAM_A', 'TEAM_B') NULL,
    `tossDecision` ENUM('BAT', 'BOWL') NULL,
    `status` ENUM('SETUP', 'TOSS', 'FIRST_INNINGS', 'SECOND_INNINGS', 'COMPLETED') NOT NULL DEFAULT 'SETUP',
    `winnerTeam` ENUM('TEAM_A', 'TEAM_B') NULL,
    `winMargin` VARCHAR(191) NULL,
    `momPlayerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `match_players` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `team` ENUM('TEAM_A', 'TEAM_B') NOT NULL,
    `battingOrder` INTEGER NULL,
    `isDoubleSided` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `match_players_matchId_playerId_key`(`matchId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `innings` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `inningsNumber` INTEGER NOT NULL,
    `battingTeam` ENUM('TEAM_A', 'TEAM_B') NOT NULL,
    `bowlingTeam` ENUM('TEAM_A', 'TEAM_B') NOT NULL,
    `totalRuns` INTEGER NOT NULL DEFAULT 0,
    `totalWickets` INTEGER NOT NULL DEFAULT 0,
    `totalOvers` DOUBLE NOT NULL DEFAULT 0,
    `totalExtras` INTEGER NOT NULL DEFAULT 0,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `innings_matchId_inningsNumber_key`(`matchId`, `inningsNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balls` (
    `id` VARCHAR(191) NOT NULL,
    `inningsId` VARCHAR(191) NOT NULL,
    `overNumber` INTEGER NOT NULL,
    `ballNumber` INTEGER NOT NULL,
    `sequenceNumber` INTEGER NOT NULL,
    `batsmanId` VARCHAR(191) NOT NULL,
    `bowlerId` VARCHAR(191) NOT NULL,
    `nonStrikerId` VARCHAR(191) NOT NULL,
    `runs` INTEGER NOT NULL DEFAULT 0,
    `isWide` BOOLEAN NOT NULL DEFAULT false,
    `isNoBall` BOOLEAN NOT NULL DEFAULT false,
    `isWicket` BOOLEAN NOT NULL DEFAULT false,
    `wicketType` ENUM('BOWLED', 'CAUGHT', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED') NULL,
    `dismissedPlayerId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `balls_inningsId_sequenceNumber_idx`(`inningsId`, `sequenceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `batting_innings` (
    `id` VARCHAR(191) NOT NULL,
    `inningsId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `runs` INTEGER NOT NULL DEFAULT 0,
    `balls` INTEGER NOT NULL DEFAULT 0,
    `fours` INTEGER NOT NULL DEFAULT 0,
    `sixes` INTEGER NOT NULL DEFAULT 0,
    `isOut` BOOLEAN NOT NULL DEFAULT false,
    `dismissalType` ENUM('BOWLED', 'CAUGHT', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED') NULL,
    `strikeRate` DOUBLE NOT NULL DEFAULT 0,

    UNIQUE INDEX `batting_innings_inningsId_playerId_key`(`inningsId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bowling_innings` (
    `id` VARCHAR(191) NOT NULL,
    `inningsId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `overs` DOUBLE NOT NULL DEFAULT 0,
    `maidens` INTEGER NOT NULL DEFAULT 0,
    `runs` INTEGER NOT NULL DEFAULT 0,
    `wickets` INTEGER NOT NULL DEFAULT 0,
    `wides` INTEGER NOT NULL DEFAULT 0,
    `noBalls` INTEGER NOT NULL DEFAULT 0,
    `economy` DOUBLE NOT NULL DEFAULT 0,

    UNIQUE INDEX `bowling_innings_inningsId_playerId_key`(`inningsId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `awards` (
    `id` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `clubId` VARCHAR(191) NOT NULL,
    `type` ENUM('MOM', 'TOP_SCORER', 'TOP_WICKET_TAKER', 'BEST_BATTING_AVG', 'BEST_BOWLING_AVG') NOT NULL,
    `period` VARCHAR(191) NULL,
    `matchId` VARCHAR(191) NULL,
    `value` VARCHAR(191) NULL,
    `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `club_members` ADD CONSTRAINT `club_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `club_members` ADD CONSTRAINT `club_members_clubId_fkey` FOREIGN KEY (`clubId`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `players` ADD CONSTRAINT `players_clubId_fkey` FOREIGN KEY (`clubId`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `series` ADD CONSTRAINT `series_clubId_fkey` FOREIGN KEY (`clubId`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_clubId_fkey` FOREIGN KEY (`clubId`) REFERENCES `clubs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `match_players` ADD CONSTRAINT `match_players_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `match_players` ADD CONSTRAINT `match_players_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `innings` ADD CONSTRAINT `innings_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balls` ADD CONSTRAINT `balls_inningsId_fkey` FOREIGN KEY (`inningsId`) REFERENCES `innings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batting_innings` ADD CONSTRAINT `batting_innings_inningsId_fkey` FOREIGN KEY (`inningsId`) REFERENCES `innings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batting_innings` ADD CONSTRAINT `batting_innings_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bowling_innings` ADD CONSTRAINT `bowling_innings_inningsId_fkey` FOREIGN KEY (`inningsId`) REFERENCES `innings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bowling_innings` ADD CONSTRAINT `bowling_innings_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `awards` ADD CONSTRAINT `awards_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

