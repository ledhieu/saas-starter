import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { userMenuItems } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await db
      .select()
      .from(userMenuItems)
      .where(eq(userMenuItems.userId, session.user.id))
      .orderBy(userMenuItems.createdAt);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('User menu GET error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, price, duration } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (price == null || isNaN(Number(price))) {
      return NextResponse.json({ error: 'Price is required' }, { status: 400 });
    }

    const [item] = await db
      .insert(userMenuItems)
      .values({
        userId: session.user.id,
        name: name.trim(),
        price: String(price),
        duration: duration != null ? Number(duration) : null,
      })
      .returning();

    return NextResponse.json({ item });
  } catch (error) {
    console.error('User menu POST error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid id is required' }, { status: 400 });
    }

    const deleted = await db
      .delete(userMenuItems)
      .where(
        and(
          eq(userMenuItems.id, Number(id)),
          eq(userMenuItems.userId, session.user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User menu DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
