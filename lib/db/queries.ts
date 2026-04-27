import { desc, and, eq, isNull, gte, lt } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, searchSessions, searchSessionCompetitors, serviceAuditLog } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.team || null;
}

export async function saveSearchSession(params: {
  userId: number;
  addressQuery: string;
  radiusKm: number;
  businessType: string | null;
  lat: number;
  lng: number;
  resultsCount: number;
  competitorIds: number[];
  competitorLatLngs: Array<{ id: number; latitude: string | null; longitude: string | null }>;
  cursor?: string | null;
}) {
  const { userId, addressQuery, radiusKm, businessType, lat, lng, resultsCount, competitorIds, competitorLatLngs, cursor } = params;

  const [session] = await db
    .insert(searchSessions)
    .values({
      userId,
      addressQuery,
      radiusKm,
      businessType,
      latitude: String(lat),
      longitude: String(lng),
      resultsCount,
      cursor: cursor || null,
    })
    .returning();

  if (!session || competitorIds.length === 0) {
    return session;
  }

  const competitorMap = new Map(competitorLatLngs.map((c) => [c.id, c]));

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const joinRows = competitorIds.map((cid) => {
    const c = competitorMap.get(cid);
    let distanceKm = null as string | null;
    if (c?.latitude && c?.longitude) {
      distanceKm = String(haversineKm(lat, lng, parseFloat(c.latitude), parseFloat(c.longitude)));
    }
    return {
      sessionId: session.id,
      competitorId: cid,
      distanceKm,
    };
  });

  await db.insert(searchSessionCompetitors).values(joinRows);

  return session;
}

/**
 * Record a service change in the audit log.
 * Same-day changes are upserted — only the latest delta for the day is kept.
 * If oldValue === newValue after upsert, the row is deleted (no meaningful change).
 */
export async function recordServiceChange(params: {
  competitorId: number;
  catalogId: string | null;
  serviceName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  const { competitorId, catalogId, serviceName, field, oldValue, newValue } = params;

  if (oldValue === newValue) return;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const baseMatch = and(
    eq(serviceAuditLog.competitorId, competitorId),
    eq(serviceAuditLog.field, field),
    eq(serviceAuditLog.serviceName, serviceName),
    gte(serviceAuditLog.changedAt, startOfDay),
    lt(serviceAuditLog.changedAt, endOfDay)
  );

  const catalogMatch = catalogId
    ? eq(serviceAuditLog.catalogId, catalogId)
    : isNull(serviceAuditLog.catalogId);

  const existing = await db
    .select()
    .from(serviceAuditLog)
    .where(and(baseMatch, catalogMatch))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const netOld = row.oldValue;
    if (netOld === newValue) {
      // Net change for the day is zero — delete the row
      await db.delete(serviceAuditLog).where(eq(serviceAuditLog.id, row.id));
      return;
    }
    // Update the existing day's entry with the latest newValue
    await db
      .update(serviceAuditLog)
      .set({ newValue, changedAt: now })
      .where(eq(serviceAuditLog.id, row.id));
    return;
  }

  await db.insert(serviceAuditLog).values({
    competitorId,
    catalogId,
    serviceName,
    field,
    oldValue,
    newValue,
    changedAt: now,
  });
}
