import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getExceptions, addException, deleteException } from '@/lib/firestore'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const exceptions = await getExceptions(session.user.id)
  return NextResponse.json(exceptions)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const id = await addException(session.user.id, body)
  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  await deleteException(session.user.id, id)
  return NextResponse.json({ success: true })
}
