import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSubjects, addSubject, updateSubject, deleteSubject } from '@/lib/firestore'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subjects = await getSubjects(session.user.id)
  return NextResponse.json(subjects)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const id = await addSubject(session.user.id, body)
  return NextResponse.json({ id }, { status: 201 })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  await updateSubject(session.user.id, body.id, body.data)
  return NextResponse.json({ success: true })
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

  await deleteSubject(session.user.id, id)
  return NextResponse.json({ success: true })
}
