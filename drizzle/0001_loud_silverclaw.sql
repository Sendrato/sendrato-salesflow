CREATE TABLE `contact_moments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`type` enum('email','phone','meeting','linkedin','slack','demo','proposal','other') NOT NULL,
	`direction` enum('inbound','outbound') DEFAULT 'outbound',
	`subject` varchar(512),
	`notes` text,
	`outcome` enum('positive','neutral','negative','no_response') DEFAULT 'neutral',
	`emailFrom` varchar(320),
	`emailTo` varchar(1024),
	`emailRaw` text,
	`source` varchar(64) DEFAULT 'manual',
	`userId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`followUpAt` timestamp,
	`followUpDone` boolean DEFAULT false,
	CONSTRAINT `contact_moments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_ingest_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rawPayload` text,
	`parsedFrom` varchar(320),
	`parsedTo` text,
	`parsedSubject` varchar(512),
	`matchedLeadId` int,
	`status` enum('matched','unmatched','error') DEFAULT 'unmatched',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_ingest_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileKey` varchar(1024) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(128),
	`fileSize` bigint,
	`category` enum('proposal','contract','presentation','report','other') DEFAULT 'other',
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`embedding` json,
	`textContent` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lead_embeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_embeddings_leadId_unique` UNIQUE(`leadId`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`website` varchar(512),
	`industry` varchar(128),
	`companySize` varchar(64),
	`location` varchar(255),
	`contactPerson` varchar(255),
	`contactTitle` varchar(255),
	`email` varchar(320),
	`phone` varchar(64),
	`status` enum('new','contacted','qualified','proposal','negotiation','won','lost','on_hold') NOT NULL DEFAULT 'new',
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`source` varchar(128),
	`assignedTo` int,
	`estimatedValue` float,
	`currency` varchar(8) DEFAULT 'USD',
	`socialMedia` text,
	`ticketingSystem` varchar(512),
	`paymentMethods` text,
	`mobileApp` varchar(255),
	`painPoints` text,
	`currentPilot` text,
	`futureOpportunities` text,
	`revenueModel` text,
	`risks` text,
	`brandTone` varchar(512),
	`surveyStatus` varchar(255),
	`notes` text,
	`enrichmentData` json,
	`enrichedAt` timestamp,
	`tags` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	`lastContactedAt` timestamp,
	`nextFollowUpAt` timestamp,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
