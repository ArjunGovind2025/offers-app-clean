
import { useEffect, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase'; // Adjust the path if needed

const SignIn = () => {
  const [user, setUser] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Automatically redirect to homepage when user is authenticated
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const signInWithGoogle = async () => {

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid); // Reference to the user's document
      const userDoc = await getDoc(userRef);

      // If the user doesn't exist in the database, create a new user document
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          credit: 0, // Initialize with a credit field
          agreedToTerms: true,
          termsAgreedDate: new Date().toISOString(),
        });
      } else {
        // Update existing user to record terms agreement
        await setDoc(userRef, {
          agreedToTerms: true,
          termsAgreedDate: new Date().toISOString(),
        }, { merge: true });
      }

      console.log('User signed in: ', user.displayName);
      // Redirect to home page after successful sign-in
      navigate('/');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error signing in: ', error.message);
      } else {
        console.error('An unknown error occurred');
      }
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let userCredential;
      
      if (isSignUp) {
        // Create new user
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Sign in existing user
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      // If the user doesn't exist in the database, create a new user document
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          credit: 0,
          agreedToTerms: true,
          termsAgreedDate: new Date().toISOString(),
        });
      } else {
        // Update existing user to record terms agreement
        await setDoc(userRef, {
          agreedToTerms: true,
          termsAgreedDate: new Date().toISOString(),
        }, { merge: true });
      }

      console.log('User signed in: ', user.email);
      navigate('/');
    } catch (error) {
      console.error('Error with email auth:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50"></div>
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-white/20 p-8 backdrop-blur-sm">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Access your offer letter analysis and credits
            </p>
          </div>
          <div className="mt-8 space-y-6">
          {!user ? (
            <div className="space-y-4">
              {/* Terms and Conditions Notice */}
              <div className="text-center">
                <p className="text-xs text-gray-600 leading-relaxed">
                  By signing in, you agree to our{' '}
                  <Link 
                    to="/terms" 
                    target="_blank"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Terms and Conditions
                  </Link>
                  {' '}and acknowledge that you have read and understood them.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={signInWithGoogle}
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-lg transition-colors duration-200 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5 mr-2" width="20" height="20" viewBox="0 0 20 20">
                    <g>
                      <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.77h5.48c-.24 1.3-.97 2.4-2.07 3.13v2.6h3.35c1.96-1.81 3.09-4.48 3.09-7.5z" fill="#4285F4"/>
                      <path d="M10 20c2.7 0 4.96-.9 6.61-2.44l-3.35-2.6c-.93.62-2.12.99-3.26.99-2.5 0-4.62-1.69-5.38-3.97H1.13v2.5C2.77 17.98 6.13 20 10 20z" fill="#34A853"/>
                      <path d="M4.62 11.98A5.99 5.99 0 014.13 10c0-.69.12-1.36.32-1.98V5.52H1.13A9.98 9.98 0 000 10c0 1.64.39 3.19 1.13 4.48l3.49-2.5z" fill="#FBBC05"/>
                      <path d="M10 4c1.47 0 2.78.51 3.81 1.51l2.85-2.85C15.95 1.16 13.7 0 10 0 6.13 0 2.77 2.02 1.13 5.52l3.49 2.5C5.38 5.69 7.5 4 10 4z" fill="#EA4335"/>
                    </g>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <div>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-2">
                      {error}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium transition-colors duration-200 ${
                      !loading
                        ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        : 'text-gray-400 bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                  </button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
