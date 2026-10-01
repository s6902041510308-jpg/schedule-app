import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'

export const { handlers, signIn, signOut, auth: getSession } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            credentials.email as string,
            credentials.password as string
          )
          const user = userCredential.user
          return {
            id: user.uid,
            email: user.email,
            name: user.displayName || user.email?.split('@')[0],
          }
        } catch {
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
