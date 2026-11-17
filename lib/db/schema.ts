import { boolean, integer, pgTable, serial, text, timestamp, date } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const busLogs = pgTable('bus_logs', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  serviceDate: date('serviceDate').notNull(),
  route: text('route').notNull(),
  busNumber: text('busNumber').notNull(),
  initialDeparture: text('initialDeparture').notNull(),
  barrierArrival: text('barrierArrival'),
  barrierDeparture: text('barrierDeparture'),
  tripMinutes: integer('tripMinutes'),
  initialTurnstile: integer('initialTurnstile'),
  barrierTurnstile: integer('barrierTurnstile'),
  transportPassengers: integer('transportPassengers'),
  notes: text('notes'),
  company: text('company'),
  point: text('point'),
  shift: text('shift'),
  dispatcher: text('dispatcher'),
  endTime: text('endTime'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
