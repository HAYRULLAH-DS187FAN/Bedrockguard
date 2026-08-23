CREATE TABLE `player_platform_profiles` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`clientFamily` enum('java','bedrock_direct','bedrock_geyser','unknown') NOT NULL,
	`confidence` int NOT NULL,
	`identityProvider` varchar(32),
	`proxyPath` varchar(40),
	`clientVersion` varchar(64),
	`sessionId` varchar(96),
	`source` varchar(24) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `player_platform_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_profile_server_player_unique` UNIQUE(`serverId`,`playerUuid`)
);
--> statement-breakpoint
CREATE TABLE `shadow_observations` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`eventId` varchar(40) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`clientFamily` enum('java','bedrock_direct','bedrock_geyser','unknown') NOT NULL,
	`candidateType` varchar(32) NOT NULL,
	`severity` int NOT NULL,
	`evidenceQuality` int NOT NULL,
	`platformFit` int NOT NULL,
	`measurementSource` varchar(32) NOT NULL,
	`status` enum('observed','suppressed') NOT NULL,
	`suppressionReason` varchar(240),
	`contextJson` text NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shadow_observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `platform_profile_server_family_idx` ON `player_platform_profiles` (`serverId`,`clientFamily`);--> statement-breakpoint
CREATE INDEX `shadow_observation_server_time_idx` ON `shadow_observations` (`serverId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `shadow_observation_server_player_time_idx` ON `shadow_observations` (`serverId`,`playerUuid`,`occurredAt`);