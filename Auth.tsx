import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Bot, Mail, Lock, User, AlertCircle } from 'lucide-react';

export function Auth({ onLogin, onGuest }: { onLogin: () => void; onGuest: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setMessage('Password reset email sent! Please check your inbox.');
      } else if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setError('Please verify your email address before logging in.');
          await auth.signOut();
        } else {
          onLogin();
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          firstName,
          lastName,
          email,
          createdAt: serverTimestamp()
        });
        await sendEmailVerification(userCredential.user);
        setMessage('Account created! Please check your email to verify your account before logging in.');
        await auth.signOut();
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          firstName: result.user.displayName?.split(' ')[0] || '',
          lastName: result.user.displayName?.split(' ').slice(1).join(' ') || '',
          email: result.user.email,
          createdAt: serverTimestamp()
        });
      }
      
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-[#0a0a0a] sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-[#141414]">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <Bot size={24} />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {isForgotPassword ? 'Reset Password' : isLogin ? 'Sign in to your account' : 'Create an account'}
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {message && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <AlertCircle size={16} />
              {message}
            </div>
          )}

          <div className="-space-y-px rounded-md shadow-sm">
            {!isLogin && !isForgotPassword && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="relative block w-full rounded-t-md border-0 py-3 pl-10 text-neutral-900 ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-black dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:focus:ring-white sm:text-sm sm:leading-6"
                    placeholder="First Name"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="relative block w-full border-0 py-3 pl-10 text-neutral-900 ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-black dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:focus:ring-white sm:text-sm sm:leading-6"
                    placeholder="Last Name"
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`relative block w-full border-0 py-3 pl-10 text-neutral-900 ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-black dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:focus:ring-white sm:text-sm sm:leading-6 ${isLogin || isForgotPassword ? 'rounded-t-md' : ''} ${isForgotPassword ? 'rounded-b-md' : ''}`}
                placeholder="Email address"
              />
            </div>
            {!isForgotPassword && (
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="relative block w-full rounded-b-md border-0 py-3 pl-10 text-neutral-900 ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-black dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:focus:ring-white sm:text-sm sm:leading-6"
                  placeholder="Password"
                />
              </div>
            )}
          </div>

          {!isForgotPassword && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="font-medium text-black hover:text-neutral-700 dark:text-white dark:hover:text-neutral-300"
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-black px-3 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:focus-visible:outline-white"
            >
              {loading ? 'Processing...' : isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </form>

        {!isForgotPassword && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-300 dark:border-neutral-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-neutral-500 dark:bg-[#141414] dark:text-neutral-400">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-3 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 disabled:opacity-50 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:hover:bg-neutral-700"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm space-y-4">
          {!isForgotPassword && (
            <button
              onClick={onGuest}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:hover:bg-neutral-700"
            >
              Continue as Guest
            </button>
          )}
          
          <div>
            {isForgotPassword ? (
              <button
                onClick={() => setIsForgotPassword(false)}
                className="font-medium text-black hover:text-neutral-700 dark:text-white dark:hover:text-neutral-300"
              >
                Back to login
              </button>
            ) : (
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-black hover:text-neutral-700 dark:text-white dark:hover:text-neutral-300"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
