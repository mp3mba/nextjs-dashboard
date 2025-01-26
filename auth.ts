import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';


const connectionPool = require('./db');

async function getUser(email: string): Promise<User | undefined> {
    try {
      // Execute the query without the generic type on query
      const user = await connectionPool.query(`SELECT * FROM users WHERE email=$1`, [email]);
  
      // Ensure rows are typed as User[]
      return (user.rows as User[])[0];
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw new Error('Failed to fetch user.');
    }
} 
 
export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
      Credentials({
        async authorize(credentials) {
          const parsedCredentials = z
            .object({ email: z.string().email(), password: z.string().min(6) })
            .safeParse(credentials);
   
          if (parsedCredentials.success) {
            const { email, password } = parsedCredentials.data;
            const user = await getUser(email);
            if (!user) return null;
            const passwordsMatch = await bcrypt.compare(password, user.password);

            if (passwordsMatch) return user;
          }
          console.log('Invalid credentials');
          return null;
        },
      }),
    ],
});