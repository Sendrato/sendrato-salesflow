CREATE TABLE `document_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`leadId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`textContent` text NOT NULL,
	`pageNumber` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shareable_presentations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`leadId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`title` varchar(512),
	`passwordHash` varchar(255),
	`expiresAt` timestamp,
	`viewCount` int DEFAULT 0,
	`lastViewedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean DEFAULT true,
	CONSTRAINT `shareable_presentations_id` PRIMARY KEY(`id`),
	CONSTRAINT `shareable_presentations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `priorityScore` int DEFAULT 0;