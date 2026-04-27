import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  index,
  numeric,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// PostGIS geography type for spatial queries
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  searchSessions: many(searchSessions),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

export const competitors = pgTable('competitors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  freshaPid: varchar('fresha_pid', { length: 50 }),
  businessType: varchar('business_type', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  latitude: text('latitude'),
  longitude: text('longitude'),
  location: geographyPoint('location'),
  rating: text('rating'),
  reviewsCount: integer('reviews_count'),
  phone: varchar('phone', { length: 50 }),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id').notNull().references(() => competitors.id, { onDelete: 'cascade' }),
  categoryName: varchar('category_name', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  durationCaption: varchar('duration_caption', { length: 100 }),
  priceFormatted: varchar('price_formatted', { length: 50 }),
  priceValueMin: integer('price_value_min'),
  priceValueMax: integer('price_value_max'),
  catalogId: varchar('catalog_id', { length: 50 }),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
}, (table) => ({
  competitorFetchedIdx: index('idx_services_competitor_fetched').on(table.competitorId, table.fetchedAt),
}));

export const serviceAuditLog = pgTable('service_audit_log', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id')
    .notNull()
    .references(() => competitors.id, { onDelete: 'cascade' }),
  catalogId: varchar('catalog_id', { length: 50 }),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  field: varchar('field', { length: 50 }).notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
});

export type ServiceAuditLog = typeof serviceAuditLog.$inferSelect;
export type NewServiceAuditLog = typeof serviceAuditLog.$inferInsert;

// ── Staging tables: population scripts write here first ──
export const stagingCompetitors = pgTable('staging_competitors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  freshaPid: varchar('fresha_pid', { length: 50 }),
  businessType: varchar('business_type', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  latitude: text('latitude'),
  longitude: text('longitude'),
  location: geographyPoint('location'),
  rating: text('rating'),
  reviewsCount: integer('reviews_count'),
  phone: varchar('phone', { length: 50 }),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stagingServices = pgTable('staging_services', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id').notNull().references(() => stagingCompetitors.id, { onDelete: 'cascade' }),
  categoryName: varchar('category_name', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  durationCaption: varchar('duration_caption', { length: 100 }),
  priceFormatted: varchar('price_formatted', { length: 50 }),
  priceValueMin: integer('price_value_min'),
  priceValueMax: integer('price_value_max'),
  catalogId: varchar('catalog_id', { length: 50 }),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
}, (table) => ({
  competitorFetchedIdx: index('idx_staging_services_competitor_fetched').on(table.competitorId, table.fetchedAt),
}));

export type StagingCompetitor = typeof stagingCompetitors.$inferSelect;
export type NewStagingCompetitor = typeof stagingCompetitors.$inferInsert;
export type StagingService = typeof stagingServices.$inferSelect;
export type NewStagingService = typeof stagingServices.$inferInsert;

export const searchLookups = pgTable('search_lookups', {
  id: serial('id').primaryKey(),
  addressQuery: text('address_query').notNull(),
  radiusKm: integer('radius_km').notNull(),
  businessType: varchar('business_type', { length: 50 }),
  latitude: text('latitude'),
  longitude: text('longitude'),
  resultsCount: integer('results_count'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const searchSessions = pgTable('search_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  addressQuery: text('address_query'),
  radiusKm: integer('radius_km'),
  businessType: varchar('business_type', { length: 50 }),
  latitude: text('latitude'),
  longitude: text('longitude'),
  resultsCount: integer('results_count'),
  cursor: text('cursor'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const searchSessionCompetitors = pgTable('search_session_competitors', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => searchSessions.id, { onDelete: 'cascade' }),
  competitorId: integer('competitor_id')
    .notNull()
    .references(() => competitors.id, { onDelete: 'cascade' }),
  distanceKm: numeric('distance_km', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tempDisputes = pgTable('temp_dispute', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull(),
  field: varchar('field', { length: 50 }).notNull(),
  discoveredValue: text('discovered_value'),
  dbValue: text('db_value'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type TempDispute = typeof tempDisputes.$inferSelect;
export type NewTempDispute = typeof tempDisputes.$inferInsert;

export const competitorsRelations = relations(competitors, ({ many }) => ({
  services: many(services),
  searchSessionCompetitors: many(searchSessionCompetitors),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  competitor: one(competitors, {
    fields: [services.competitorId],
    references: [competitors.id],
  }),
}));

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;

export const searchSessionsRelations = relations(searchSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [searchSessions.userId],
    references: [users.id],
  }),
  searchSessionCompetitors: many(searchSessionCompetitors),
}));

export const searchSessionCompetitorsRelations = relations(searchSessionCompetitors, ({ one }) => ({
  session: one(searchSessions, {
    fields: [searchSessionCompetitors.sessionId],
    references: [searchSessions.id],
  }),
  competitor: one(competitors, {
    fields: [searchSessionCompetitors.competitorId],
    references: [competitors.id],
  }),
}));

export type SearchSession = typeof searchSessions.$inferSelect;
export type NewSearchSession = typeof searchSessions.$inferInsert;
export type SearchSessionCompetitor = typeof searchSessionCompetitors.$inferSelect;
export type NewSearchSessionCompetitor = typeof searchSessionCompetitors.$inferInsert;

export const userMenuItems = pgTable('user_menu_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type UserMenuItem = typeof userMenuItems.$inferSelect;
export type NewUserMenuItem = typeof userMenuItems.$inferInsert;

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type SearchLookup = typeof searchLookups.$inferSelect;
export type NewSearchLookup = typeof searchLookups.$inferInsert;
