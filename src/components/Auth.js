
import { useEffect, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase'; // Adjust the path if needed

const SignIn = () => {
  const [user, setUser] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!agreedToTerms) {
      alert('Please agree to the Terms and Conditions before signing in.');
      return;
    }

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
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
              {/* Terms and Conditions Checkbox */}
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="terms-checkbox" className="text-sm text-gray-700 leading-relaxed">
                  I agree to the{' '}
                  <Link 
                    to="/terms" 
                    target="_blank"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Terms and Conditions
                  </Link>
                  {' '}and acknowledge that I have read and understood them.
                </label>
              </div>

              <button
                onClick={signInWithGoogle}
                disabled={!agreedToTerms}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md transition-colors duration-200 ${
                  agreedToTerms
                    ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    : 'text-gray-400 bg-gray-300 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {agreedToTerms ? 'Sign in with Google' : 'Agree to Terms to Continue'}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Successfully signed in!
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Welcome, {user.displayName}!</p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => auth.signOut()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
