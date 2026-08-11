import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import dostLogo from "../assets/images/dost-logo.png";
import dostBg from "../assets/images/dost.png";
import { API_BASE_URL } from '../services/api';
import { getPasswordRequirementChecks, validatePasswordStrength } from '../lib/passwordValidation';
import PasswordRequirements from '../components/PasswordRequirements';
import { getDashboardPathForRole } from '../lib/roleLabels';

type AuthMode = 'welcome' | 'login' | 'signup' | 'forgot';

const AuthPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, register, continueAsGuest } = useAuth();

    const getModeFromUrl = (search: string): AuthMode => {
        const urlParams = new URLSearchParams(search);
        const modeParam = urlParams.get('mode');
        if (modeParam === 'login') return 'login';
        if (modeParam === 'signup') return 'signup';
        return 'welcome';
    };
    const [mode, setMode] = useState<AuthMode>(getModeFromUrl(location.search));

    // Keep mode in sync with URL for direct login/signup links
    useEffect(() => {
        setMode(getModeFromUrl(location.search));
    }, [location.search]);

    // Forgot password state
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const handleForgotSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setResetMessage('');
        setResetLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/password-reset-request/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });
            const data = await response.json();
            setResetMessage(data.message || 'If this email exists, a reset link will be sent.');
        } catch (err) {
            setResetMessage('Error sending reset request.');
        } finally {
            setResetLoading(false);
        }
    };

    const schoolLevelChoices = [
        { value: 'Junior High School', label: 'Junior High School' },
        { value: 'Senior High School', label: 'Senior High School' },
        { value: 'Undergraduate', label: 'Undergraduate' },
        { value: 'Graduate', label: 'Graduate' },
        { value: 'Postgraduate', label: 'Postgraduate' }
    ];

    const sexChoices = [
        { value: 'Female', label: 'Female' },
        { value: 'Male', label: 'Male' },
        { value: 'Prefer not to say', label: 'Prefer not to say' }
    ];

    const ageChoices = [
        { value: '10 and below', label: '10 years old and below' },
        { value: '11-15', label: '11 - 15 years old' },
        { value: '16-20', label: '16 - 20 years old' },
        { value: '21-25', label: '21 - 25 years old' },
        { value: '26-30', label: '26 - 30 years old' },
        { value: '31-35', label: '31 - 35 years old' },
        { value: '36-40', label: '36 - 40 years old' },
        { value: '41-45', label: '41 - 45 years old' },
        { value: '46-50', label: '46 - 50 years old' },
        { value: '51-55', label: '51 - 55 years old' },
        { value: '56-60', label: '56 - 60 years old' },
        { value: '61 and above', label: '61 years old and above' }
    ];

    const regionChoices = [
        { value: 'NCR', label: '[NCR] National Capital Region' },
        { value: 'CAR', label: '[CAR] Cordillera Administrative Region' },
        { value: 'R01', label: '[R01] Region 1 (Ilocos Region)' },
        { value: 'R02', label: '[R02] Region 2 (Cagayan Valley Region)' },
        { value: 'R03', label: '[R03] Region 3 (Central Luzon Region)' },
        { value: 'R4A', label: '[R4A] Region 4A (CALABARZON Region)' },
        { value: 'R4B', label: '[R4B] Region 4B (MIMAROPA Region)' },
        { value: 'R05', label: '[R05] Region 5 (Bicol Region)' },
        { value: 'R06', label: '[R06] Western Visayas Region' },
        { value: 'R07', label: '[R07] Central Visayas Region' },
        { value: 'R08', label: '[R08] Eastern Visayas Region' },
        { value: 'R09', label: '[R09] Zamboanga Peninsula Region' },
        { value: 'R10', label: '[R10] Northern Mindanao Region' },
        { value: 'R11', label: '[R11] Davao Region' },
        { value: 'R12', label: '[R12] SOCCSKSARGEN Region' },
        { value: 'R13', label: '[R13] Caraga Administrative Region' },
        { value: 'R18', label: '[R18] Negros Island Region (NIR)' },
        { value: 'BARMM', label: '[BARMM] Bangsamoro Autonomous Region in Muslim Mindanao' },
        { value: 'N/A', label: '[N/A] Not Applicable (Overseas)' }
    ];

    const clientTypeChoices = [
        { value: 'Student', label: 'Student' },
        { value: 'DOST Employee', label: 'DOST Employee' },
        { value: 'Other Government Employee', label: 'Other Government Employee' },
        { value: 'Librarian/Library Staff', label: 'Librarian/Library Staff' },
        { value: 'Teaching Personnel', label: 'Teaching Personnel' },
        { value: 'Administrative Personnel', label: 'Administrative Personnel' },
        { value: 'Researcher', label: 'Researcher' },
        { value: 'Others', label: 'Others' }
    ];

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [signupFullName, setSignupFullName] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupSchoolLevel, setSignupSchoolLevel] = useState('');
    const [signupSchoolName, setSignupSchoolName] = useState('');
    const [signupClientType, setSignupClientType] = useState('');
    const [signupClientTypeOther, setSignupClientTypeOther] = useState('');
    const [signupSex, setSignupSex] = useState('');
    const [signupAge, setSignupAge] = useState('');
    const [signupRegion, setSignupRegion] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
    const [signupTermsAccepted, setSignupTermsAccepted] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isStudentClient = signupClientType === 'Student';
    const isOtherClient = signupClientType === 'Others';
    const signupPasswordChecks = getPasswordRequirementChecks(signupPassword);

    useEffect(() => {
        if (!isStudentClient) {
            setSignupSchoolLevel('');
            setSignupSchoolName('');
        }
    }, [isStudentClient]);

    useEffect(() => {
        if (!isOtherClient) {
            setSignupClientTypeOther('');
        }
    }, [isOtherClient]);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const result = await login(email, password);
            
            if (result.success) {
                navigate(getDashboardPathForRole(result.user?.role));
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (signupPassword !== signupConfirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const passwordValidationError = validatePasswordStrength(signupPassword);
        if (passwordValidationError) {
            setError(passwordValidationError);
            return;
        }

        if (!signupTermsAccepted) {
            setError('Please accept the Terms and Conditions to continue.');
            return;
        }

        if (isStudentClient && (!signupSchoolLevel || !signupSchoolName.trim())) {
            setError('School level and school name are required for students.');
            return;
        }

        if (isOtherClient && !signupClientTypeOther.trim()) {
            setError('Please specify your client type when Others is selected.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await register({
                email: signupEmail,
                password: signupPassword,
                username: signupUsername,
                full_name: signupFullName,
                school_level: isStudentClient ? signupSchoolLevel : '',
                school_name: isStudentClient ? signupSchoolName : '',
                client_type: signupClientType,
                client_type_other: isOtherClient ? signupClientTypeOther.trim() : '',
                sex: signupSex,
                age: signupAge,
                region: signupRegion,
                terms_accepted: signupTermsAccepted,
                terms_version: 'v2026-04-01',
                category: ''
            });

            if (result.success) {
                setSuccessMessage('Account created successfully. Redirecting...');
                navigate('/search');
            } else {
                setError(result.error || 'Sign up failed');
            }
        } catch (err) {
            console.error('Signup error:', err);
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinueAsGuest = async () => {
        setIsLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            const result = await continueAsGuest();
            
            if (result.success) {
                navigate('/search');
            } else {
                setError('Could not create guest session. Please try again.');
            }
        } catch (err) {
            console.error('Guest session error:', err);
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative">
            {/* Background Image with Blur */}
            <div 
                className="absolute inset-0 z-0"
                style={{ 
                    backgroundImage: `url(${dostBg})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center', 
                    backgroundRepeat: 'no-repeat',
                    filter: 'blur(6px)',
                    height: '100%',
                    width: '100%',
                }}
            />
            {/* Header */}
            <div className="sticky top-0 left-0 right-0 z-40 bg-gradient-to-b from-[#555555] to-[#212121] text-white shadow-md relative">
                <div className="flex items-center justify-between max-w-[100rem] mx-auto px-3 py-3 w-full">
                    
                    {/* Left Side: Branding */}
                    <div className="flex items-center space-x-4">
                        <img src={dostLogo} alt="DOST SciNet-Phil Logo" className="h-12 w-auto" />
                        <div className="hidden md:block text-sm border-l border-white pl-4 ml-4 leading-tight opacity-100">
                            LitPath AI: <br /> Smart PathFinder for Theses and Dissertation
                        </div>
                    </div>

                    {/* Right Side: OPAC Link */}
                    <nav className="flex space-x-6">
                        <a 
                            href="http://scinet.dost.gov.ph/#/opac" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-blue-200 transition-colors text-sm font-medium"
                        >
                            Online Public Access Catalog
                        </a>
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex justify-center items-center flex-1 py-10 px-4 relative z-10">
                <div className={`w-full ${mode === 'signup' ? 'max-w-4xl' : 'max-w-md'} bg-white p-6 sm:p-8 rounded-xl shadow-xl transition-all duration-200`}>
                    
                    {/* Welcome Screen */}
                    {mode === 'welcome' && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <BookOpen className="w-16 h-16 text-[#1E74BC] mx-auto mb-4" />
                                <h2 className="text-3xl font-bold text-gray-800">Welcome to LitPath AI</h2>
                                <p className="text-gray-600 mt-2">Smart PathFinder for Theses and Dissertations</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setMode('login')}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-[#1E74BC] text-white py-4 rounded-lg hover:bg-[#184d79] transition-colors font-semibold text-lg shadow-md disabled:bg-gray-400"
                                >
                                    <User className="w-5 h-5" />
                                    Login
                                </button>

                                <button
                                    onClick={() => setMode('signup')}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white text-[#1E74BC] py-4 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-lg border border-[#1E74BC] disabled:bg-gray-100"
                                >
                                    <BookOpen className="w-5 h-5" />
                                    Create Account
                                </button>

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-4 bg-white text-gray-500">or</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleContinueAsGuest}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-700 py-4 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-lg border border-gray-300 disabled:bg-gray-200"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    {isLoading ? 'Starting...' : 'Continue as Guest'}
                                </button>

                                <p className="text-xs text-center text-gray-500 mt-4">
                                    Guest sessions are temporary. Your data will be cleared when you start a new search session.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Login Form */}
                    {mode === 'login' && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Login</h2>
                                <p className="text-gray-600 mt-1">Access your research and bookmarks</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                                            required
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-[#1E74BC] text-white py-4 rounded-lg hover:bg-[#184d79] transition-colors font-semibold text-lg shadow-md disabled:bg-gray-400"
                                >
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </button>
                            </form>

                            <div className="flex flex-col items-center gap-2">
                                <button
                                    type="button"
                                    className="text-[#1E74BC] hover:underline text-sm"
                                    onClick={() => { setMode('signup'); setError(''); }}
                                >
                                    Don't have an account? Sign up
                                </button>
                                <button
                                    type="button"
                                    className="text-[#1E74BC] hover:underline text-sm"
                                    onClick={() => { setMode('forgot'); setResetEmail(''); setResetMessage(''); }}
                                >
                                    Forgot password?
                                </button>
                                <button
                                    onClick={() => { setMode('welcome'); setError(''); }}
                                    className="text-gray-500 hover:underline text-sm"
                                >
                                    ← Back to options
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Signup Form */}
                    {mode === 'signup' && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Create Your Account</h2>
                                <p className="text-gray-600 mt-1">Set up your LitPath AI profile</p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                                    {successMessage}
                                </div>
                            )}

                            <form onSubmit={handleSignup} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="signupFullName" className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="signupFullName"
                                        value={signupFullName}
                                        onChange={(e) => setSignupFullName(e.target.value)}
                                        placeholder="Juan Dela Cruz"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="signupUsername" className="block text-sm font-medium text-gray-700 mb-1">
                                        Username <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="signupUsername"
                                        value={signupUsername}
                                        onChange={(e) => setSignupUsername(e.target.value)}
                                        placeholder="username"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="signupEmail"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="signupClientType" className="block text-sm font-medium text-gray-700 mb-1">
                                        Client Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="signupClientType"
                                        value={signupClientType}
                                        onChange={(e) => {
                                            const nextClientType = e.target.value;
                                            setSignupClientType(nextClientType);
                                            if (nextClientType !== 'Others') {
                                                setSignupClientTypeOther('');
                                            }
                                        }}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>Select client type</option>
                                        {clientTypeChoices.map(choice => (
                                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {isOtherClient && (
                                    <div>
                                        <label htmlFor="signupClientTypeOther" className="block text-sm font-medium text-gray-700 mb-1">
                                            Please specify <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="signupClientTypeOther"
                                            value={signupClientTypeOther}
                                            onChange={(e) => setSignupClientTypeOther(e.target.value)}
                                            placeholder="Enter your client type"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                )}

                                {isStudentClient && (
                                    <>
                                <div>
                                    <label htmlFor="signupSchoolLevel" className="block text-sm font-medium text-gray-700 mb-1">
                                        School Level <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="signupSchoolLevel"
                                        value={signupSchoolLevel}
                                        onChange={(e) => setSignupSchoolLevel(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>Select school level</option>
                                        {schoolLevelChoices.map(choice => (
                                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="signupSchoolName" className="block text-sm font-medium text-gray-700 mb-1">
                                        School Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="signupSchoolName"
                                        value={signupSchoolName}
                                        onChange={(e) => setSignupSchoolName(e.target.value)}
                                        placeholder="Your school or institution"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                    </>
                                )}

                                <div>
                                    <label htmlFor="signupSex" className="block text-sm font-medium text-gray-700 mb-1">
                                        Sex <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="signupSex"
                                        value={signupSex}
                                        onChange={(e) => setSignupSex(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>Select sex</option>
                                        {sexChoices.map(choice => (
                                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="signupAge" className="block text-sm font-medium text-gray-700 mb-1">
                                        Age Range <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="signupAge"
                                        value={signupAge}
                                        onChange={(e) => setSignupAge(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>Select age range</option>
                                        {ageChoices.map(choice => (
                                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="signupRegion" className="block text-sm font-medium text-gray-700 mb-1">
                                        Region <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="signupRegion"
                                        value={signupRegion}
                                        onChange={(e) => setSignupRegion(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>Select region</option>
                                        {regionChoices.map(choice => (
                                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showSignupPassword ? 'text' : 'password'}
                                            id="signupPassword"
                                            value={signupPassword}
                                            onChange={(e) => setSignupPassword(e.target.value)}
                                            placeholder="At least 8 characters"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                                            required
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showSignupPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="signupConfirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                        Confirm Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showSignupConfirmPassword ? 'text' : 'password'}
                                            id="signupConfirmPassword"
                                            value={signupConfirmPassword}
                                            onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your password"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                                            required
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showSignupConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <PasswordRequirements checks={signupPasswordChecks} />
                                </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <input
                                        id="signupTerms"
                                        type="checkbox"
                                        checked={signupTermsAccepted}
                                        onChange={(e) => setSignupTermsAccepted(e.target.checked)}
                                        className="mt-1"
                                        disabled={isLoading}
                                    />
                                    <label htmlFor="signupTerms" className="text-sm text-gray-700">
                                        <span className="text-red-500">*</span> I hereby acknowledge that I am fully informed of the foregoing and that I
                                        consent to the collection and processing of my Personal Data by DOST-STII. I
                                        agree to the{' '}
                                        <Link to="/terms-and-conditions" className="text-[#1E74BC] hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                                            Terms and Conditions
                                        </Link>
                                        .
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-[#1E74BC] text-white py-4 rounded-lg hover:bg-[#184d79] transition-colors font-semibold text-lg shadow-md disabled:bg-gray-400"
                                >
                                    {isLoading ? 'Creating account...' : 'Sign Up'}
                                </button>
                            </form>

                            <div className="flex flex-col items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                                    className="text-[#1E74BC] hover:underline text-sm"
                                >
                                    Already have an account? Login
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMode('welcome'); setError(''); setSuccessMessage(''); }}
                                    className="text-gray-500 hover:underline text-sm"
                                >
                                    ← Back to options
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Forgot Password Form */}
                    {mode === 'forgot' && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
                                <p className="text-gray-600 mt-1">Enter your email to receive a reset link</p>
                            </div>
                            <form onSubmit={handleForgotSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="resetEmail"
                                        value={resetEmail}
                                        onChange={e => setResetEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        disabled={resetLoading}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-[#1E74BC] text-white py-4 rounded-lg hover:bg-[#184d79] transition-colors font-semibold text-lg shadow-md disabled:bg-gray-400"
                                >
                                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                            {resetMessage && <div className="text-green-600 text-sm text-center">{resetMessage}</div>}
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-gray-500 hover:underline text-sm"
                                >
                                    ← Back to Login
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-200 py-4 text-center text-gray-500 text-[10px] flex-none">
                <p>© 2025 DOST-STII Science and Technology Information Institute</p>
            </div>
        </div>
    );
};

export default AuthPage;