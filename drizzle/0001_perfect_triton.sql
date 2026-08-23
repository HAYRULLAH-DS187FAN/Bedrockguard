CREATE TABLE `agent_nonces` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`nonce` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_nonces_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_nonces_server_nonce_unique` UNIQUE(`serverId`,`nonce`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40),
	`actorUserId` int,
	`action` varchar(96) NOT NULL,
	`target` varchar(160),
	`summary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_detections` (
	`id` varchar(40) NOT NULL,
	`eventId` varchar(40) NOT NULL,
	`category` varchar(48) NOT NULL,
	`ruleId` varchar(80) NOT NULL,
	`label` varchar(120) NOT NULL,
	`points` int NOT NULL,
	`confidence` int NOT NULL,
	`explanation` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_detections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`sourceEventId` varchar(96) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`type` varchar(40) NOT NULL,
	`content` text,
	`metadataJson` text NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_server_source_unique` UNIQUE(`serverId`,`sourceEventId`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`isOnline` boolean NOT NULL DEFAULT false,
	`suspicionScore` int NOT NULL DEFAULT 0,
	`scoreUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`flagsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `players_id` PRIMARY KEY(`id`),
	CONSTRAINT `players_server_player_unique` UNIQUE(`serverId`,`playerUuid`)
);
--> statement-breakpoint
CREATE TABLE `sanctions` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`eventId` varchar(40),
	`action` enum('warning','kick','temp_ban','review') NOT NULL,
	`status` enum('pending_confirmation','queued','executed','failed','cancelled') NOT NULL DEFAULT 'pending_confirmation',
	`requiresConfirmation` boolean NOT NULL DEFAULT true,
	`reason` text NOT NULL,
	`durationMinutes` int,
	`requestedByUserId` int,
	`confirmedByUserId` int,
	`confirmedAt` timestamp,
	`agentAcknowledgedAt` timestamp,
	`executionMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sanctions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`agentKeyId` varchar(80) NOT NULL,
	`agentSecretEncrypted` text NOT NULL,
	`discordWebhookEncrypted` text,
	`settingsJson` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `servers_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `servers_agent_key_unique` UNIQUE(`agentKeyId`)
);
--> statement-breakpoint
CREATE TABLE `whitelisted_players` (
	`id` varchar(40) NOT NULL,
	`serverId` varchar(40) NOT NULL,
	`playerUuid` varchar(96) NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`reason` varchar(240) NOT NULL,
	`createdByUserId` int NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whitelisted_players_id` PRIMARY KEY(`id`),
	CONSTRAINT `whitelist_server_player_unique` UNIQUE(`serverId`,`playerUuid`)
);
--> statement-breakpoint
CREATE INDEX `agent_nonces_expiry_idx` ON `agent_nonces` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `audit_server_time_idx` ON `audit_logs` (`serverId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `detections_event_idx` ON `moderation_detections` (`eventId`);--> statement-breakpoint
CREATE INDEX `events_server_player_time_idx` ON `moderation_events` (`serverId`,`playerUuid`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `players_server_risk_idx` ON `players` (`serverId`,`suspicionScore`);--> statement-breakpoint
CREATE INDEX `sanctions_server_status_idx` ON `sanctions` (`serverId`,`status`);--> statement-breakpoint
CREATE INDEX `sanctions_server_player_idx` ON `sanctions` (`serverId`,`playerUuid`);