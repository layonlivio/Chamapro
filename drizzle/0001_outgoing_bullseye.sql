CREATE TABLE `billing_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`professionalId` int NOT NULL,
	`stripeInvoiceId` varchar(128),
	`stripePaymentIntentId` varchar(128),
	`eventType` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(32),
	`city` varchar(120) NOT NULL,
	`state` varchar(2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `lead_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`professionalId` int NOT NULL,
	`status` enum('new','viewed','contacted','won','lost') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`viewedAt` timestamp,
	CONSTRAINT `lead_matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_matches_request_professional_idx` UNIQUE(`requestId`,`professionalId`)
);
--> statement-breakpoint
CREATE TABLE `professional_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`category` varchar(80) NOT NULL,
	`city` varchar(120) NOT NULL,
	`state` varchar(2) NOT NULL,
	`serviceArea` varchar(240),
	`bio` text,
	`plan` enum('free','pro') NOT NULL DEFAULT 'free',
	`isActive` boolean NOT NULL DEFAULT true,
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professional_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `professional_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`professionalId` int NOT NULL,
	`amountCents` int,
	`message` text NOT NULL,
	`status` enum('sent','accepted','rejected') NOT NULL DEFAULT 'sent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`nameSnapshot` varchar(160) NOT NULL,
	`city` varchar(120) NOT NULL,
	`state` varchar(2) NOT NULL,
	`category` varchar(80) NOT NULL,
	`urgency` enum('flexible','next_days','soon','today') NOT NULL DEFAULT 'flexible',
	`description` text NOT NULL,
	`status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `lead_matches_professional_idx` ON `lead_matches` (`professionalId`,`status`);--> statement-breakpoint
CREATE INDEX `professional_profiles_region_idx` ON `professional_profiles` (`city`,`category`);--> statement-breakpoint
CREATE INDEX `service_requests_region_idx` ON `service_requests` (`city`,`category`);