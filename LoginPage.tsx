
import React, { useState, useEffect } from 'react';
import { LogoIcon, SparklesIcon } from './components/Icons';
import { loginUser } from './services/userService';
import Spinner from './components/common/Spinner';
import { type User } from './types';
import { APP_VERSION } from './services/appConfig';
import { loadData } from './services/indexedDBService';

interface LoginPageProps {
    onLoginSuccess: (user: User) => void;
}

const errorMessages: Record<string, string> = {
    emailRequired: 'Email is required to log in.',
    emailNotRegistered: 'This email is not registered. Please check your email or sign up for an account.',
    accountInactive: 'Your account is inactive. Please contact support for assistance.',
    tokenInvalid: 'Your connection token is invalid or has expired. A new one will be assigned automatically.',
    safetyBlock: 'The request was blocked by the safety filter. Please modify your prompt.',
    badRequest: 'The AI model reported a problem with the request (Bad Request). Please check your input.',
    permissionDenied: 'Permission denied. Your API key may be invalid or lack permissions for this model.',
    resourceExhausted: 'The API is temporarily overloaded (rate limit exceeded). Please wait a moment and try again.',
    googleUnavailable: 'The AI service is currently unavailable or experiencing issues. Please try again later.',
    networkError: 'Network error. Please check your internet connection and try again.',
    networkErrorRetryFailed: 'A network error occurred. We tried a backup server, but it also failed. Please check your internet connection and try again.',
    unexpectedError: 'An unexpected error occurred. Please try again.',
};

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState('light'); // Default to light

    // Load theme from localStorage
    useEffect(() => {
        const loadTheme = async () => {
            const savedTheme = await loadData<string>('theme');
            if (savedTheme) {
                setTheme(savedTheme);
            } else {
                setTheme('light'); // Default to light
            }
        };
        loadTheme();
    }, []);

    // Apply theme to document
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        
        const result = await loginUser(email);
        
        if (result.success === true) {
            onLoginSuccess(result.user);
        } else {
            const errorKey = result.message as string;
            setError(errorMessages[errorKey] || result.message);
        }
        setIsLoading(false);
    };

    return (
        <div className="relative flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-[#050505] overflow-hidden p-4">
            
            {/* Background Ambient Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-start/20 dark:bg-brand-start/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-end/10 dark:bg-brand-end/10 rounded-full blur-[120px] pointer-events-none animate-float"></div>

            {/* Login Card */}
            <div className="w-full max-w-md relative z-10">
                <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-neutral-200 dark:border-white/10 rounded-3xl shadow-lg dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 sm:p-10 relative overflow-hidden">
                    
                    {/* Top Gradient Line Decoration */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-50"></div>

                    <div className="text-center mb-8">
                        <div className="inline-flex justify-center mb-6 filter drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                            <LogoIcon className="w-40 text-neutral-900 dark:text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
                            Welcome Back!
                        </h1>
                         <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                            Log in to access the ESAIE AI platform.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-center">
                            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                    
                    <form className="space-y-6" onSubmit={handleLogin}>
                         <div className="space-y-2">
                            <label htmlFor="email-input" className="text-xs font-bold text-neutral-600 dark:text-neutral-500 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                id="email-input"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-neutral-50 dark:bg-black/40 border border-neutral-300 dark:border-white/10 rounded-xl px-4 py-3.5 text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-brand-start/50 focus:border-brand-start/50 transition-all font-medium"
                                placeholder="Enter your registered email address"
                                disabled={isLoading}
                             />
                        </div>
                       
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full flex justify-center items-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-brand-start to-brand-end text-white font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                            >
                                {isLoading ? <Spinner /> : (
                                    <>
                                        Log In
                                        <SparklesIcon className="w-4 h-4 text-white/70" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
                
                 <p className="text-center text-[10px] text-neutral-500 dark:text-neutral-600 font-mono mt-6 uppercase tracking-widest">
                    System Secured • {APP_VERSION}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
