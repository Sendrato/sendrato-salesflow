CREATE TABLE `person_lead_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`personId` int NOT NULL,
	`leadId` int NOT NULL,
	`relationship` enum('contact_at','introduced_by','decision_maker','champion','partner','other') NOT NULL DEFAULT 'contact_at',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `person_lead_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(64),
	`linkedInUrl` varchar(512),
	`personType` enum('prospect','contact','partner','reseller','influencer','investor','other') NOT NULL DEFAULT 'prospect',
	`company` varchar(255),
	`title` varchar(255),
	`notes` text,
	`tags` json,
	`source` varchar(128) DEFAULT 'manual',
	`twitterUrl` varchar(512),
	`enrichmentData` json,
	`enrichedAt` timestamp,
	`lastContactedAt` timestamp,
	`nextFollowUpAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contact_moments` ADD `personId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `leadType` enum('default','event','festival','conference','hospitality','saas','retail') DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `leadAttributes` json;