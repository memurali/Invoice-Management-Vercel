'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Toast, useToast } from '@/components/Toast';
import { EnvChecker } from '@/components/EnvChecker';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const router = useRouter();
  
  const { user, signup, login, error: authError, loading, firebaseInitialized } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Show error if Firebase initialization fails
  useEffect(() => {
    if (!loading && !firebaseInitialized && authError) {
      // Show more specific error messages based on the error
      if (authError.includes('Firebase configuration is missing')) {
        showToast('⚠️ Configuration Error: Firebase environment variables are not properly set. Please contact support.', 'error');
      } else if (authError.includes('Authentication service is unavailable')) {
        showToast('⚠️ Service Unavailable: Authentication service is temporarily unavailable. Please try again later.', 'error');
      } else {
        showToast(`⚠️ Authentication Error: ${authError}`, 'error');
      }
    }
  }, [loading, firebaseInitialized, authError, showToast]);

  // Show authentication errors
  useEffect(() => {
    if (authError && firebaseInitialized) {
      showToast(authError, 'error');
    }
  }, [authError, firebaseInitialized, showToast]);

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem('green-earth-credentials');
    if (savedCredentials) {
      try {
        const { email, rememberMe: savedRememberMe } = JSON.parse(savedCredentials);
        setFormData(prev => ({ ...prev, email }));
        setRememberMe(savedRememberMe);
                 } catch {
     }
    }
  }, []);

  // Save credentials when user opts to remember
  const saveCredentials = (email: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem('green-earth-credentials', JSON.stringify({
        email,
        rememberMe: true
      }));
    } else {
      localStorage.removeItem('green-earth-credentials');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLogin) {
      if (!formData.name) {
        newErrors.name = 'Name is required';
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        
        // Save credentials if remember me is checked
        saveCredentials(formData.email, rememberMe);
        
        showToast('Login successful! Welcome back to Green Earth!', 'success');
        
        // Delay navigation to show toast
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        await signup(formData.email, formData.password, formData.name);
        
        // Save credentials if remember me is checked
        saveCredentials(formData.email, rememberMe);
        
        showToast('Account created successfully! Welcome to Green Earth!', 'success');
        
        // Delay navigation to show toast
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch {
      // Error is already handled in the useAuth hook and will be displayed below
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormComplete = () => {
    if (isLogin) {
      return formData.email.trim() !== '' && formData.password.trim() !== '';
    } else {
      return formData.email.trim() !== '' && 
             formData.password.trim() !== '' && 
             formData.confirmPassword.trim() !== '' && 
             formData.name.trim() !== '';
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', confirmPassword: '', name: '' });
    setErrors({});
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      showToast('Please enter your email address', 'error');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(forgotPasswordEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    
    setIsResettingPassword(true);
    
    try {
      // Use Firebase Auth's built-in password reset
      const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
      const auth = getAuth();
      
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      
      showToast(`Password reset email sent to ${forgotPasswordEmail}! Check your inbox and spam folder.`, 'success');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
      
    } catch (error: any) {
      
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many password reset attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };



  // Show loading state while Firebase is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#64A950] rounded-full mb-4">
            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image
              src="/logo_complete.png"
              alt="Green Earth Logo"
              width={200}
              height={80}
              className="h-auto"
              priority
            />
          </div>
          <p className="text-gray-600 text-lg">Invoice Management System</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Toggle Buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => !isLogin && toggleMode()}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-white text-[#1F76B9] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => isLogin && toggleMode()}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-white text-[#1F76B9] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F76B9] focus:border-transparent text-gray-900 placeholder-gray-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F76B9] focus:border-transparent text-gray-900 placeholder-gray-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F76B9] focus:border-transparent text-gray-900 placeholder-gray-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F76B9] focus:border-transparent text-gray-900 placeholder-gray-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Confirm your password"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            {/* Remember Me Checkbox (only show on login) */}
            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-[#64A950] focus:ring-[#64A950] border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <button
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[#1F76B9] hover:text-[#64A950] font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {/* Auth Error Display */}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isFormComplete()
                    ? 'bg-[#1F76B9] text-white hover:bg-[#1a6ba8] focus:ring-[#1F76B9]'
                    : 'bg-[#64A950] text-white hover:bg-[#5a9a47] focus:ring-[#64A950]'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={toggleMode}
                className="text-[#1F76B9] hover:text-[#64A950] font-medium transition-colors"
              >
                {isLogin ? 'Sign up here' : 'Sign in here'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2024 Green Earth. All rights reserved.
          </p>
        </div>
      </div>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      
             {/* Forgot Password Modal */}
       {showForgotPassword && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
             <div className="text-center mb-6">
               <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
               <p className="text-gray-600">
                 Enter your email address and we&apos;ll send you a password reset link.
               </p>
             </div>
             
             <form onSubmit={handleForgotPassword} className="space-y-4">
               <div>
                 <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                   Email Address
                 </label>
                 <input
                   type="email"
                   id="reset-email"
                   value={forgotPasswordEmail}
                   onChange={(e) => setForgotPasswordEmail(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F76B9] focus:border-transparent text-gray-900 placeholder-gray-500"
                   placeholder="Enter your email address"
                   required
                 />
               </div>
               
               <div className="flex space-x-3 pt-4">
                 <button
                   type="button"
                   onClick={() => {
                     setShowForgotPassword(false);
                     setForgotPasswordEmail('');
                   }}
                   className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   disabled={isResettingPassword}
                   className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                     isResettingPassword
                       ? 'bg-gray-400 cursor-not-allowed text-white'
                       : 'bg-[#1F76B9] text-white hover:bg-[#1a6ba8]'
                   }`}
                 >
                   {isResettingPassword ? (
                     <span className="flex items-center justify-center">
                       <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Sending...
                     </span>
                   ) : (
                     'Send Reset Link'
                   )}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}

      {/* Environment Variables Checker (Development only) */}
      <EnvChecker />
    </div>
  );
}
