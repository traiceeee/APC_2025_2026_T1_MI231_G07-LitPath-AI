// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Save, User, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';
import { getPasswordRequirementChecks, validatePasswordStrength } from '../lib/passwordValidation';
import PasswordRequirements from '../components/PasswordRequirements';

const AccountProfile = () => {
    const navigate = useNavigate();
    const { user, setUser, changePassword } = useAuth();

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        email: '',
        school_level: '',
        school_name: '',
        client_type: '',
        client_type_other: '',
        sex: '',
        age: '',
        region: ''
    });

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const passwordChecks = getPasswordRequirementChecks(newPassword);

    useEffect(() => {
        if (!user) return;
        if (user.role === 'guest') {
            navigate('/search');
            return;
        }

        setFormData({
            full_name: user.full_name || '',
            username: user.username || '',
            email: user.email || '',
            school_level: user.school_level || '',
            school_name: user.school_name || '',
            client_type: ['Student', 'DOST Employee', 'Other Government Employee', 'Librarian/Library Staff', 'Teaching Personnel', 'Administrative Personnel', 'Researcher', 'Others'].includes(user.client_type)
                ? user.client_type
                : (user.client_type ? 'Others' : ''),
            client_type_other: ['Student', 'DOST Employee', 'Other Government Employee', 'Librarian/Library Staff', 'Teaching Personnel', 'Administrative Personnel', 'Researcher', 'Others'].includes(user.client_type)
                ? ''
                : (user.client_type || ''),
            sex: user.sex || '',
            age: user.age || '',
            region: user.region || ''
        });
    }, [user, navigate]);

    const clientTypeChoices = ['Student', 'DOST Employee', 'Other Government Employee', 'Librarian/Library Staff', 'Teaching Personnel', 'Administrative Personnel', 'Researcher', 'Others'];
    const sexChoices = ['Female', 'Male', 'Prefer not to say'];
    const ageChoices = [
        '10 and below', '11-15', '16-20', '21-25', '26-30', '31-35',
        '36-40', '41-45', '46-50', '51-55', '56-60', '61 and above'
    ];
    const regionChoices = [
        'NCR', 'CAR', 'R01', 'R02', 'R03', 'R4A', 'R4B', 'R05', 'R06', 'R07',
        'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'BARMM', 'N/A'
    ];
    const schoolLevelChoices = [
        'Junior High School', 'Senior High School', 'Undergraduate', 'Graduate', 'Postgraduate'
    ];
    const isStudentClient = formData.client_type === 'Student';
    const isOtherClient = formData.client_type === 'Others';

    const handleProfileSave = async () => {
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const sessionRaw = localStorage.getItem('litpath_session');
            const token = sessionRaw ? JSON.parse(sessionRaw).session_token : null;

            if (!token) {
                setError('Session expired. Please log in again.');
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/auth/update-profile/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || 'Failed to update profile');
                setLoading(false);
                return;
            }

            const updatedUser = {
                ...(user || {}),
                ...data.user
            };

            localStorage.setItem('litpath_auth_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setMessage('Profile updated successfully.');

            if (newPassword || confirmPassword || currentPassword) {
                if (!currentPassword) {
                    setError('Current password is required to change password.');
                    setLoading(false);
                    return;
                }
                if (newPassword !== confirmPassword) {
                    setError('New password and confirm password do not match.');
                    setLoading(false);
                    return;
                }
                const passwordValidationError = validatePasswordStrength(newPassword);
                if (passwordValidationError) {
                    setError(passwordValidationError);
                    setLoading(false);
                    return;
                }

                const passwordResult = await changePassword(currentPassword, newPassword);
                if (!passwordResult.success) {
                    setError(passwordResult.error || 'Password update failed.');
                    setLoading(false);
                    return;
                }

                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setMessage('Profile and password updated successfully.');
            }
        } catch (err) {
            setError('Connection error while updating profile.');
        } finally {
            setLoading(false);
        }
    };

    if (!user || user.role === 'guest') return null;

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900">Account Profile</h1>
                    <button
                        onClick={() => navigate('/search')}
                        className="text-sm text-[#1E74BC] hover:underline"
                    >
                        Back to Search
                    </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    {message && <div className="mb-4 p-3 rounded bg-green-100 text-green-700 text-sm">{message}</div>}
                    {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm">{error}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.full_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Username</label>
                            <input
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.username}
                                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Email</label>
                            <input
                                type="email"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Client Type</label>
                            <select
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.client_type}
                                onChange={(e) => {
                                    const nextClientType = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        client_type: nextClientType,
                                        client_type_other: nextClientType === 'Others' ? prev.client_type_other : '',
                                        school_level: nextClientType === 'Student' ? prev.school_level : '',
                                        school_name: nextClientType === 'Student' ? prev.school_name : ''
                                    }));
                                }}
                            >
                                <option value="">Select client type</option>
                                {clientTypeChoices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {isOtherClient && (
                            <div>
                                <label className="text-sm font-medium text-gray-700">Please specify</label>
                                <input
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                    value={formData.client_type_other}
                                    onChange={(e) => setFormData(prev => ({ ...prev, client_type_other: e.target.value }))}
                                    placeholder="Enter your client type"
                                />
                            </div>
                        )}

                        {isStudentClient && (
                            <>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">School Level</label>
                                    <select
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                        value={formData.school_level}
                                        onChange={(e) => setFormData(prev => ({ ...prev, school_level: e.target.value }))}
                                    >
                                        <option value="">Select school level</option>
                                        {schoolLevelChoices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">School Name</label>
                                    <input
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                        value={formData.school_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, school_name: e.target.value }))}
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label className="text-sm font-medium text-gray-700">Sex</label>
                            <select
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.sex}
                                onChange={(e) => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                            >
                                <option value="">Select sex</option>
                                {sexChoices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Age Range</label>
                            <select
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.age}
                                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                            >
                                <option value="">Select age range</option>
                                {ageChoices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Region</label>
                            <select
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={formData.region}
                                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                            >
                                <option value="">Select region</option>
                                {regionChoices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Security</h2>
                    <p className="text-xs text-gray-500 mb-4">Leave blank if you do not want to change password.</p>
                    <div className="mb-4">
                        <PasswordRequirements checks={passwordChecks} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Current Password</label>
                            <input
                                type="password"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">New Password</label>
                            <input
                                type="password"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                type="password"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleProfileSave}
                        disabled={loading}
                        className="inline-flex items-center gap-2 bg-[#E54584] hover:bg-[#cc3a74] text-white font-semibold px-6 py-3 rounded-full disabled:opacity-60"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountProfile;
 