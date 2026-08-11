// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Database,
    Edit2,
    HardDriveDownload,
    KeyRound,
    LayoutDashboard,
    Loader2,
    LogOut,
    Menu,
    RefreshCw,
    Save,
    Search,
    Settings,
    ShieldCheck,
    UserRoundCog,
    UserRoundPlus,
    UserX,
    Users,
    X,
    Trash2,
} from 'lucide-react';
import dostLogo from '../../assets/images/dost-logo.png';
import { API_BASE_URL, apiHeaders } from '../../services/api';
import { getPasswordRequirementChecks, validatePasswordStrength } from '../../lib/passwordValidation';
import PasswordRequirements from '../../components/PasswordRequirements';
import { getRoleLabel } from '../../lib/roleLabels';

const roleOptions = [
    { value: 'user', label: 'User' },
    { value: 'staff', label: 'Library Administrator' },
    { value: 'admin', label: 'IT Administrator' },
];

const emptyForm = {
    email: '',
    username: '',
    full_name: '',
    role: 'user',
    is_active: true,
    password: '',
    confirmPassword: '',
};

const emptyStructureForm = {
    name: '',
    schema_version: '',
    migration_label: '',
    change_summary: '',
    rollback_script: '',
    applied_at: '',
    is_current: false,
};

const emptyBackupForm = {
    name: '',
    backup_type: 'full',
    target_environment: '',
    storage_location: '',
    retention_days: 30,
    size_mb: '',
    status: 'planned',
    notes: '',
    backup_started_at: '',
    backup_completed_at: '',
};

const defaultSystemSettings = {
    ai_model_settings: {
        provider: 'gemini',
        generation_model: 'gemini-3-flash',
        rerank_model: 'gemini-2.5-flash',
        rewrite_model: 'gemini-2.5-flash-lite',
        temperature: 0.2,
        top_p: 0.8,
        max_output_tokens: 1024,
    },
    search_settings: {
        ranking_strategy: 'hybrid',
        result_limit: 10,
        rerank_top_k: 15,
        distance_threshold: 1.2,
        enable_subject_filters: false,
        enable_year_filters: true,
        enable_strict_matching: true,
        relevance_floor: 0.5,
    },
    environment_config: {
        database_url: '',
        email_host_user: '',
        email_host_password: '',
        gemini_api_key: '',
        hf_token: '',
    },
};

const normalizeSystemSettings = (rawSettings = {}) => ({
    ai_model_settings: {
        ...defaultSystemSettings.ai_model_settings,
        ...(rawSettings.ai_model_settings || {}),
    },
    search_settings: {
        ...defaultSystemSettings.search_settings,
        ...(rawSettings.search_settings || {}),
    },
    environment_config: {
        ...defaultSystemSettings.environment_config,
        ...(rawSettings.environment_config || {}),
    },
});

const parseApiResponse = async (response, fallbackMessage) => {
    const responseText = await response.text();
    if (!responseText) {
        return {};
    }

    try {
        return JSON.parse(responseText);
    } catch {
        const responseType = response.headers.get('content-type') || 'unknown content type';
        throw new Error(`${fallbackMessage} The server returned ${responseType} instead of JSON.`);
    }
};

const formatDateTime = (value) => {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleString();
};

const getBadgeClasses = (role, isActive) => {
    if (!isActive) {
        return 'border-slate-200 bg-slate-100 text-slate-600';
    }

    if (role === 'admin') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }

    if (role === 'staff') {
        return 'border-sky-200 bg-sky-50 text-sky-700';
    }

    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const formatChoiceLabel = (value) => value ? value.replace(/_/g, ' ') : 'Unknown';

const ACCOUNT_PAGE_SIZE = 8;
const SYSTEM_LOG_PAGE_SIZE = 10;

const ITAdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const userMenuRef = useRef(null);

    const tabs = [
        { key: 'accounts', label: 'Account Management', icon: Users },
        { key: 'security', label: 'System Logs', icon: ShieldCheck },
        { key: 'system', label: 'System Settings', icon: Settings },
    ];
    const [activeTab, setActiveTab] = useState('accounts');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [pageError, setPageError] = useState('');
    const [settingsError, setSettingsError] = useState('');
    const [settingsUpdatedAt, setSettingsUpdatedAt] = useState('');
    const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [accountPage, setAccountPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [systemSettings, setSystemSettings] = useState(defaultSystemSettings);
    const [databaseLoading, setDatabaseLoading] = useState(true);
    const [databaseSaving, setDatabaseSaving] = useState(false);
    const [databaseError, setDatabaseError] = useState('');
    const [databaseStructures, setDatabaseStructures] = useState([]);
    const [backupRecords, setBackupRecords] = useState([]);
    const [structureForm, setStructureForm] = useState(emptyStructureForm);
    const [backupForm, setBackupForm] = useState(emptyBackupForm);
    const [editingStructureId, setEditingStructureId] = useState(null);
    const [editingBackupId, setEditingBackupId] = useState(null);
    const [securityLoading, setSecurityLoading] = useState(true);
    const [securityError, setSecurityError] = useState('');
    const [securityAuditLogs, setSecurityAuditLogs] = useState([]);
    const [systemLogSearch, setSystemLogSearch] = useState('');
    const [systemLogSeverity, setSystemLogSeverity] = useState('all');
    const [systemLogOutcome, setSystemLogOutcome] = useState('all');
    const [systemLogPage, setSystemLogPage] = useState(1);

    const showToast = (type, message) => {
        setToast({ show: true, type, message });
        window.setTimeout(() => {
            setToast((current) => (current.message === message ? { show: false, type: 'success', message: '' } : current));
        }, 3000);
    };

    const loadAccounts = async () => {
        setLoading(true);
        setPageError('');

        try {
            const response = await fetch(`${API_BASE_URL}/admin/user-accounts/`, {
                headers: apiHeaders(true),
            });
            const data = await parseApiResponse(response, 'Unable to load user accounts.');

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load user accounts.');
            }

            setAccounts(data.accounts || []);
        } catch (error) {
            setPageError(error.message || 'Unable to load user accounts.');
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        setSettingsLoading(true);
        setSettingsError('');

        try {
            const response = await fetch(`${API_BASE_URL}/admin/system-settings/`, {
                headers: apiHeaders(true),
            });
            const data = await parseApiResponse(response, 'Unable to load system settings.');

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load system settings.');
            }

            setSettingsUpdatedAt(data.settings?.updated_at || '');
            setSystemSettings(normalizeSystemSettings(data.settings || {}));
        } catch (error) {
            setSettingsError(error.message || 'Unable to load system settings.');
        } finally {
            setSettingsLoading(false);
        }
    };

    const loadDatabaseAdminData = async () => {
        setDatabaseLoading(true);
        setDatabaseError('');

        try {
            const [structuresResponse, backupsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/admin/database-structures/`, { headers: apiHeaders(true) }),
                fetch(`${API_BASE_URL}/admin/database-backups/`, { headers: apiHeaders(true) }),
            ]);

            const structuresData = await parseApiResponse(structuresResponse, 'Unable to load database structures.');
            const backupsData = await parseApiResponse(backupsResponse, 'Unable to load database backups.');

            if (!structuresResponse.ok || !structuresData.success) {
                throw new Error(structuresData.message || 'Unable to load database structures.');
            }
            if (!backupsResponse.ok || !backupsData.success) {
                throw new Error(backupsData.message || 'Unable to load database backups.');
            }

            setDatabaseStructures(structuresData.records || []);
            setBackupRecords(backupsData.records || []);
        } catch (error) {
            setDatabaseError(error.message || 'Unable to load database admin data.');
        } finally {
            setDatabaseLoading(false);
        }
    };

    const loadSystemLogs = async () => {
        setSecurityLoading(true);
        setSecurityError('');

        try {
            const response = await fetch(`${API_BASE_URL}/admin/system-logs/?limit=500`, {
                headers: apiHeaders(true),
            });
            const data = await parseApiResponse(response, 'Unable to load system logs.');

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to load system logs.');
            }

            setSecurityAuditLogs(data.records || []);
        } catch (error) {
            setSecurityError(error.message || 'Unable to load system logs.');
        } finally {
            setSecurityLoading(false);
        }
    };


    useEffect(() => {
        loadAccounts();
        loadSettings();
        loadSystemLogs();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!toast.show) return undefined;
        const timer = window.setTimeout(() => {
            setToast({ show: false, type: 'success', message: '' });
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [toast.show]);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingAccount(null);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (account) => {
        setEditingAccount(account);
        setForm({
            email: account.email || '',
            username: account.username || '',
            full_name: account.full_name || '',
            role: account.role || 'user',
            is_active: Boolean(account.is_active),
            password: '',
            confirmPassword: '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const updateSystemSection = (section, key, value) => {
        setSystemSettings((current) => ({
            ...current,
            [section]: {
                ...current[section],
                [key]: value,
            },
        }));
    };

    const validateUrl = (value, label) => {
        if (!value) return '';
        try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return `${label} must use http or https.`;
            }
        } catch {
            return `${label} must be a valid URL.`;
        }
        return '';
    };

    const submitSystemSettings = async (event) => {
        event.preventDefault();
        setSettingsSaving(true);
        setSettingsError('');

        const ai = systemSettings.ai_model_settings;
        const search = systemSettings.search_settings;

        if (!ai.provider.trim()) {
            setSettingsError('AI provider is required.');
            setSettingsSaving(false);
            return;
        }
        if (!ai.generation_model.trim()) {
            setSettingsError('Generation model is required.');
            setSettingsSaving(false);
            return;
        }
        if (!ai.rewrite_model.trim()) {
            setSettingsError('Rewrite model is required.');
            setSettingsSaving(false);
            return;
        }
        if (!ai.rerank_model.trim()) {
            setSettingsError('Rerank model is required.');
            setSettingsSaving(false);
            return;
        }
        if (ai.temperature < 0 || ai.temperature > 2) {
            setSettingsError('Temperature must be between 0 and 2.');
            setSettingsSaving(false);
            return;
        }
        if (ai.top_p <= 0 || ai.top_p > 1) {
            setSettingsError('Top-p must be greater than 0 and at most 1.');
            setSettingsSaving(false);
            return;
        }
        if (search.result_limit < 1 || search.result_limit > 50) {
            setSettingsError('Result limit must be between 1 and 50.');
            setSettingsSaving(false);
            return;
        }
        if (search.rerank_top_k < 1 || search.rerank_top_k > 50) {
            setSettingsError('Rerank top-k must be between 1 and 50.');
            setSettingsSaving(false);
            return;
        }
        if (search.distance_threshold < 0 || search.distance_threshold > 5) {
            setSettingsError('Distance threshold must be between 0 and 5.');
            setSettingsSaving(false);
            return;
        }

        // Validate DATABASE_URL format if provided
        if (systemSettings.environment_config.database_url) {
            const dbUrlError = validateUrl(systemSettings.environment_config.database_url, 'Database URL');
            if (dbUrlError) {
                setSettingsError(dbUrlError);
                setSettingsSaving(false);
                return;
            }
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/system-settings/`, {
                method: 'PATCH',
                headers: apiHeaders(true),
                body: JSON.stringify(systemSettings),
            });

            const data = await parseApiResponse(response, 'Unable to save account.');
            if (!response.ok || !data.success) {
                const errors = data.errors
                    ? Object.values(data.errors).flat().join(' ')
                    : data.message || 'Unable to save system settings.';
                throw new Error(errors);
            }

            setSettingsUpdatedAt(data.settings?.updated_at || settingsUpdatedAt);
            setSystemSettings(normalizeSystemSettings(data.settings || systemSettings));
            showToast('success', 'System settings updated.');
            await loadSettings();
        } catch (error) {
            setSettingsError(error.message || 'Unable to save system settings.');
        } finally {
            setSettingsSaving(false);
        }
    };

    const filteredAccounts = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return accounts.filter((account) => {
            const matchesSearch = !normalizedSearch || [account.full_name, account.username, account.email]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(normalizedSearch));
            const matchesRole = roleFilter === 'all' || account.role === roleFilter;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' && account.is_active)
                || (statusFilter === 'inactive' && !account.is_active);

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [accounts, roleFilter, searchTerm, statusFilter]);

    const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNT_PAGE_SIZE));

    const paginatedAccounts = useMemo(() => {
        const startIndex = (accountPage - 1) * ACCOUNT_PAGE_SIZE;
        return filteredAccounts.slice(startIndex, startIndex + ACCOUNT_PAGE_SIZE);
    }, [accountPage, filteredAccounts]);

    useEffect(() => {
        setAccountPage(1);
    }, [activeTab, roleFilter, searchTerm, statusFilter]);

    useEffect(() => {
        if (accountPage > accountTotalPages) {
            setAccountPage(accountTotalPages);
        }
    }, [accountPage, accountTotalPages]);

    const sortedSystemLogs = useMemo(() => (
        [...securityAuditLogs].sort((left, right) => {
            const leftTime = new Date(left.occurred_at || left.created_at || 0).getTime();
            const rightTime = new Date(right.occurred_at || right.created_at || 0).getTime();
            return rightTime - leftTime;
        })
    ), [securityAuditLogs]);

    const filteredSystemLogs = useMemo(() => {
        const normalizedSearch = systemLogSearch.trim().toLowerCase();
        return sortedSystemLogs.filter((log) => {
            const matchesSearch = !normalizedSearch || [
                log.actor_label,
                log.action_summary,
                log.target_label,
                log.event_type,
                log.severity,
                log.outcome,
                log.ip_address,
                log.notes,
            ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));
            const matchesSeverity = systemLogSeverity === 'all' || log.severity === systemLogSeverity;
            const matchesOutcome = systemLogOutcome === 'all' || log.outcome === systemLogOutcome;

            return matchesSearch && matchesSeverity && matchesOutcome;
        });
    }, [sortedSystemLogs, systemLogOutcome, systemLogSearch, systemLogSeverity]);

    const systemLogTotalPages = Math.max(1, Math.ceil(filteredSystemLogs.length / SYSTEM_LOG_PAGE_SIZE));

    const paginatedSystemLogs = useMemo(() => {
        const startIndex = (systemLogPage - 1) * SYSTEM_LOG_PAGE_SIZE;
        return filteredSystemLogs.slice(startIndex, startIndex + SYSTEM_LOG_PAGE_SIZE);
    }, [filteredSystemLogs, systemLogPage]);

    useEffect(() => {
        setSystemLogPage(1);
    }, [systemLogOutcome, systemLogSearch, systemLogSeverity]);

    useEffect(() => {
        if (systemLogPage > systemLogTotalPages) {
            setSystemLogPage(systemLogTotalPages);
        }
    }, [systemLogPage, systemLogTotalPages]);

    const metrics = useMemo(() => {
        const total = accounts.length;
        const active = accounts.filter((account) => account.is_active).length;
        const admins = accounts.filter((account) => account.role === 'admin').length;
        const staff = accounts.filter((account) => account.role === 'staff').length;

        return { total, active, admins, staff };
    }, [accounts]);

    const systemLogStats = useMemo(() => {
        const total = sortedSystemLogs.length;
        const errors = sortedSystemLogs.filter((log) => log.event_type === 'error' || log.severity === 'critical').length;
        const warnings = sortedSystemLogs.filter((log) => log.severity === 'warning').length;
        const success = sortedSystemLogs.filter((log) => log.outcome === 'success').length;
        const lastEvent = sortedSystemLogs[0]?.occurred_at || sortedSystemLogs[0]?.created_at || '';
        return { total, errors, warnings, success, lastEvent };
    }, [sortedSystemLogs]);

    const submitForm = async (event) => {
        event.preventDefault();
        setSaving(true);
        setPageError('');

        const isCreateMode = !editingAccount;
        if (form.password) {
            const passwordError = validatePasswordStrength(form.password);
            if (passwordError) {
                setPageError(passwordError);
                setSaving(false);
                return;
            }
            if (form.password !== form.confirmPassword) {
                setPageError('Password confirmation does not match.');
                setSaving(false);
                return;
            }
        } else if (isCreateMode) {
            setPageError('Password is required when creating a new account.');
            setSaving(false);
            return;
        }

        const payload = {
            email: form.email.trim().toLowerCase(),
            username: form.username.trim(),
            full_name: form.full_name.trim(),
            role: form.role,
            is_active: form.is_active,
        };

        if (form.password) {
            payload.password = form.password;
        }

        try {
            const response = await fetch(
                isCreateMode
                    ? `${API_BASE_URL}/admin/user-accounts/`
                    : `${API_BASE_URL}/admin/user-accounts/${editingAccount.id}/`,
                {
                    method: isCreateMode ? 'POST' : 'PATCH',
                    headers: apiHeaders(true),
                    body: JSON.stringify(payload),
                }
            );

            const data = await parseApiResponse(response, 'Unable to update account status.');
            if (!response.ok || !data.success) {
                const errors = data.errors
                    ? Object.values(data.errors).flat().join(' ')
                    : data.message || 'Unable to save account.';
                throw new Error(errors);
            }

            showToast('success', isCreateMode ? 'User account created.' : 'User account updated.');
            closeModal();
            await loadAccounts();
        } catch (error) {
            setPageError(error.message || 'Unable to save account.');
        } finally {
            setSaving(false);
        }
    };

    const toggleAccountState = async (account) => {
        if (!window.confirm(`${account.is_active ? 'Deactivate' : 'Reactivate'} ${account.username}?`)) {
            return;
        }

        setSaving(true);
        setPageError('');

        try {
            const response = await fetch(`${API_BASE_URL}/admin/user-accounts/${account.id}/`, {
                method: 'PATCH',
                headers: apiHeaders(true),
                body: JSON.stringify({ is_active: !account.is_active }),
            });

            const data = await parseApiResponse(response, 'Unable to save system settings.');
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to update account status.');
            }

            showToast('success', account.is_active ? 'Account deactivated.' : 'Account reactivated.');
            await loadAccounts();
        } catch (error) {
            setPageError(error.message || 'Unable to update account status.');
        } finally {
            setSaving(false);
        }
    };

    const resetStructureForm = () => {
        setStructureForm(emptyStructureForm);
        setEditingStructureId(null);
    };

    const resetBackupForm = () => {
        setBackupForm(emptyBackupForm);
        setEditingBackupId(null);
    };

    const editStructure = (record) => {
        setEditingStructureId(record.id);
        setStructureForm({
            name: record.name || '',
            schema_version: record.schema_version || '',
            migration_label: record.migration_label || '',
            change_summary: record.change_summary || '',
            rollback_script: record.rollback_script || '',
            applied_at: record.applied_at ? new Date(record.applied_at).toISOString().slice(0, 16) : '',
            is_current: Boolean(record.is_current),
        });
    };

    const editBackup = (record) => {
        setEditingBackupId(record.id);
        setBackupForm({
            name: record.name || '',
            backup_type: record.backup_type || 'full',
            target_environment: record.target_environment || '',
            storage_location: record.storage_location || '',
            retention_days: Number(record.retention_days || 30),
            size_mb: record.size_mb ?? '',
            status: record.status || 'planned',
            notes: record.notes || '',
            backup_started_at: record.backup_started_at ? new Date(record.backup_started_at).toISOString().slice(0, 16) : '',
            backup_completed_at: record.backup_completed_at ? new Date(record.backup_completed_at).toISOString().slice(0, 16) : '',
        });
    };

    const submitStructure = async (event) => {
        event.preventDefault();
        setDatabaseSaving(true);
        setDatabaseError('');

        try {
            const payload = {
                ...structureForm,
                applied_at: structureForm.applied_at ? new Date(structureForm.applied_at).toISOString() : null,
            };

            const response = await fetch(
                editingStructureId
                    ? `${API_BASE_URL}/admin/database-structures/${editingStructureId}/`
                    : `${API_BASE_URL}/admin/database-structures/`,
                {
                    method: editingStructureId ? 'PATCH' : 'POST',
                    headers: apiHeaders(true),
                    body: JSON.stringify(payload),
                }
            );

            const data = await parseApiResponse(response, 'Unable to save structure record.');
            if (!response.ok || !data.success) {
                const errors = data.errors
                    ? Object.values(data.errors).flat().join(' ')
                    : data.message || 'Unable to save structure record.';
                throw new Error(errors);
            }

            showToast('success', editingStructureId ? 'Structure record updated.' : 'Structure record created.');
            resetStructureForm();
            await loadDatabaseAdminData();
        } catch (error) {
            setDatabaseError(error.message || 'Unable to save structure record.');
        } finally {
            setDatabaseSaving(false);
        }
    };

    const submitBackup = async (event) => {
        event.preventDefault();
        setDatabaseSaving(true);
        setDatabaseError('');

        try {
            const payload = {
                ...backupForm,
                retention_days: Number(backupForm.retention_days),
                size_mb: backupForm.size_mb === '' ? null : Number(backupForm.size_mb),
                backup_started_at: backupForm.backup_started_at ? new Date(backupForm.backup_started_at).toISOString() : null,
                backup_completed_at: backupForm.backup_completed_at ? new Date(backupForm.backup_completed_at).toISOString() : null,
            };

            const response = await fetch(
                editingBackupId
                    ? `${API_BASE_URL}/admin/database-backups/${editingBackupId}/`
                    : `${API_BASE_URL}/admin/database-backups/`,
                {
                    method: editingBackupId ? 'PATCH' : 'POST',
                    headers: apiHeaders(true),
                    body: JSON.stringify(payload),
                }
            );

            const data = await parseApiResponse(response, 'Unable to save backup record.');
            if (!response.ok || !data.success) {
                const errors = data.errors
                    ? Object.values(data.errors).flat().join(' ')
                    : data.message || 'Unable to save backup record.';
                throw new Error(errors);
            }

            showToast('success', editingBackupId ? 'Backup record updated.' : 'Backup record created.');
            resetBackupForm();
            await loadDatabaseAdminData();
        } catch (error) {
            setDatabaseError(error.message || 'Unable to save backup record.');
        } finally {
            setDatabaseSaving(false);
        }
    };

    const deleteStructure = async (recordId) => {
        if (!window.confirm('Delete this structure record?')) return;

        setDatabaseSaving(true);
        setDatabaseError('');
        try {
            const response = await fetch(`${API_BASE_URL}/admin/database-structures/${recordId}/`, {
                method: 'DELETE',
                headers: apiHeaders(true),
            });
            const data = await parseApiResponse(response, 'Unable to delete structure record.');
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete structure record.');
            }
            showToast('success', 'Structure record deleted.');
            await loadDatabaseAdminData();
        } catch (error) {
            setDatabaseError(error.message || 'Unable to delete structure record.');
        } finally {
            setDatabaseSaving(false);
        }
    };

    const deleteBackup = async (recordId) => {
        if (!window.confirm('Delete this backup record?')) return;

        setDatabaseSaving(true);
        setDatabaseError('');
        try {
            const response = await fetch(`${API_BASE_URL}/admin/database-backups/${recordId}/`, {
                method: 'DELETE',
                headers: apiHeaders(true),
            });
            const data = await parseApiResponse(response, 'Unable to delete backup record.');
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Unable to delete backup record.');
            }
            showToast('success', 'Backup record deleted.');
            await loadDatabaseAdminData();
        } catch (error) {
            setDatabaseError(error.message || 'Unable to delete backup record.');
        } finally {
            setDatabaseSaving(false);
        }
    };

    const passwordChecks = getPasswordRequirementChecks(form.password || '');
    const configuredIntegrations = Object.values(systemSettings.environment_config || {}).filter(Boolean).length;
    const currentStructure = databaseStructures.find((record) => record.is_current);
    const completedBackups = backupRecords.filter((record) => record.status === 'completed').length;
    const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || 'IT Administration';

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-gray-50 text-slate-900">
            <div className="z-50 flex-none bg-gradient-to-b from-[#555555] to-[#212121] text-white shadow-md">
                <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between px-3 py-3">
                    <div className="flex items-center space-x-4">
                        <img src={dostLogo} alt="DOST Logo" className="h-12 w-auto pl-2" />
                        <div className="ml-4 hidden border-l border-white pl-4 text-sm leading-tight opacity-100 md:block">
                            LitPath AI: <br /> Smart PathFinder for Theses and Dissertation
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden text-right sm:block">
                            <div className="text-xs text-gray-400">Philippine Standard Time</div>
                            <div className="text-sm font-medium text-white">
                                {currentDateTime.toLocaleString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true,
                                })}
                            </div>
                        </div>
                        <div className="relative" ref={userMenuRef}>
                            <button
                                type="button"
                                onClick={() => setShowUserMenu((current) => !current)}
                                className="flex items-center gap-2 rounded p-1.5 transition-colors hover:bg-white/10"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-blue-600 text-xs font-bold text-white shadow-md">
                                    {user?.username?.[0]?.toUpperCase() || 'A'}
                                </div>
                                <ChevronDown size={14} className="text-gray-400" />
                            </button>
                            {showUserMenu ? (
                                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 text-gray-800 shadow-xl">
                                    <div className="border-b border-gray-100 px-4 py-3">
                                        <p className="text-sm font-bold">{user?.full_name || 'Admin User'}</p>
                                        <p className="truncate text-xs text-gray-500">{user?.email || 'admin@litpath.ai'}</p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-blue-600" />
                                            <span className="text-xs font-medium text-gray-700">{getRoleLabel(user?.role)}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/it-admin/dashboard');
                                            setActiveTab('accounts');
                                            setShowUserMenu(false);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                                    >
                                        <LayoutDashboard size={16} /> Dashboard
                                    </button>
                                    <div className="my-1 border-t border-gray-100" />
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <aside className={`z-20 flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
                    <div className={`flex h-16 items-center border-b border-gray-100 ${isSidebarOpen ? 'justify-start px-4' : 'justify-center p-0'}`}>
                        <button
                            type="button"
                            title="Toggle sidebar"
                            onClick={() => setIsSidebarOpen((current) => !current)}
                            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-100"
                        >
                            <Menu size={24} />
                        </button>
                    </div>
                    <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    title={tab.label}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex w-full items-center rounded-lg p-3 text-sm transition-colors ${isSidebarOpen ? 'justify-start' : 'justify-center'} ${activeTab === tab.key ? 'bg-blue-50 font-semibold text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Icon size={20} className="flex-shrink-0" />
                                    <span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100' : 'ml-0 w-0 overflow-hidden opacity-0'}`}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div className={`overflow-hidden whitespace-nowrap border-t border-gray-100 p-4 text-center text-xs text-gray-400 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'h-0 p-0 opacity-0'}`}>
                        &copy; 2025 LitPath AI
                    </div>
                </aside>

                <main className="relative flex flex-1 flex-col overflow-hidden bg-gray-50 p-4">
                    <div className="h-full overflow-y-auto pr-1">
                        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h1 className="text-xl font-bold text-gray-800">{activeTabLabel}</h1>
                                    <p className="text-sm text-gray-500">Manage platform access, logs, and system configuration.</p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                            {activeTab === 'accounts' ? (
                                <>
                                    <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        Total {metrics.total}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        Active {metrics.active}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-rose-800">
                                        <ShieldCheck className="h-4 w-4 text-rose-600" />
                                        IT admins {metrics.admins}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-sky-800">
                                        <UserRoundCog className="h-4 w-4 text-sky-600" />
                                        Library admins {metrics.staff}
                                    </span>
                                </>
                            ) : activeTab === '__database_disabled__' ? (
                                <>
                                    <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                                        <Database className="h-4 w-4 text-slate-400" />
                                        Structures {databaseStructures.length}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-sky-800">
                                        <HardDriveDownload className="h-4 w-4 text-sky-600" />
                                        Backups {backupRecords.length}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        Completed {completedBackups}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-semibold text-slate-700">
                                        Current schema: {currentStructure?.schema_version || 'Not set'}
                                    </span>
                                </>
                            ) : activeTab === 'security' ? (
                                <>
                                    <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                                        Logs {systemLogStats.total}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                                        <KeyRound className="h-4 w-4 text-emerald-600" />
                                        Warnings {systemLogStats.warnings}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-sky-800">
                                        <UserRoundCog className="h-4 w-4 text-sky-600" />
                                        Latest {formatDateTime(systemLogStats.lastEvent)}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        Success {systemLogStats.success}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="inline-flex items-center gap-2 font-semibold text-rose-800">
                                        <AlertCircle className="h-4 w-4 text-rose-600" />
                                        Errors {systemLogStats.errors}
                                    </span>
                                </>
                            ) : (
                                <span className="font-semibold text-slate-700">System settings administration</span>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'accounts' ? (
                            <>
                                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Manage User Accounts</h2>
                                        <p className="mt-1 text-sm text-slate-600">Create, edit, deactivate, and assign roles for every registered account.</p>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={loadAccounts}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                        <button
                                            type="button"
                                            onClick={openCreateModal}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                                        >
                                            <UserRoundPlus className="h-4 w-4" />
                                            Add user
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <Search className="h-4 w-4 text-slate-400" />
                                        <input
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="Search by name, email, or username"
                                            className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                        />
                                    </label>
                                    <select
                                        value={roleFilter}
                                        onChange={(event) => setRoleFilter(event.target.value)}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                    >
                                        <option value="all">All roles</option>
                                        {roleOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={statusFilter}
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                    >
                                        <option value="all">All statuses</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                        {pageError ? (
                            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{pageError}</span>
                            </div>
                        ) : null}

                                <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                                    {loading ? (
                                        <div className="flex min-h-[280px] items-center justify-center">
                                            <div className="flex items-center gap-3 text-slate-500">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Loading user accounts...
                                            </div>
                                        </div>
                                    ) : filteredAccounts.length === 0 ? (
                                        <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                                            <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                                                <Users className="h-8 w-8" />
                                            </div>
                                            <h3 className="mt-4 text-lg font-bold text-slate-900">No matching accounts</h3>
                                            <p className="mt-2 max-w-md text-sm text-slate-500">
                                                Adjust your filters or create a new user account to start populating the table.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                                    <tr>
                                                        <th className="px-6 py-4">User</th>
                                                        <th className="px-6 py-4">Role</th>
                                                        <th className="px-6 py-4">Status</th>
                                                        <th className="px-6 py-4">Created</th>
                                                        <th className="px-6 py-4">Last login</th>
                                                        <th className="px-6 py-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {paginatedAccounts.map((account) => {
                                                        const isSelf = String(user?.id) === String(account.id);
                                                        return (
                                                            <tr key={account.id} className="transition hover:bg-slate-50/70">
                                                                <td className="px-6 py-5 align-top">
                                                                    <div className="flex items-start gap-4">
                                                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                                                                            {(account.full_name || account.username || '?').slice(0, 1).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-slate-900">{account.full_name || 'Unnamed user'}</p>
                                                                            <p className="text-sm text-slate-500">@{account.username}</p>
                                                                            <p className="text-sm text-slate-500">{account.email}</p>
                                                                            {isSelf ? (
                                                                                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                                                    Current account
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-5 align-top">
                                                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeClasses(account.role, account.is_active)}`}>
                                                                        {account.role_label || getRoleLabel(account.role)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5 align-top">
                                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${account.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                                                                        {account.is_active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                                        {account.is_active ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-5 align-top text-sm text-slate-600">{formatDateTime(account.created_at)}</td>
                                                                <td className="px-6 py-5 align-top text-sm text-slate-600">{formatDateTime(account.last_login)}</td>
                                                                <td className="px-6 py-5 align-top">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEditModal(account)}
                                                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleAccountState(account)}
                                                                            disabled={saving || isSelf}
                                                                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${account.is_active ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-60'}`}
                                                                        >
                                                                            {account.is_active ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                                                            {account.is_active ? 'Deactivate' : 'Reactivate'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            </div>
                                            {filteredAccounts.length > ACCOUNT_PAGE_SIZE ? (
                                                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="text-sm text-slate-600">
                                                        Showing {((accountPage - 1) * ACCOUNT_PAGE_SIZE) + 1}-{Math.min(accountPage * ACCOUNT_PAGE_SIZE, filteredAccounts.length)} of {filteredAccounts.length} accounts
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAccountPage((current) => Math.max(1, current - 1))}
                                                            disabled={accountPage === 1}
                                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Previous
                                                        </button>
                                                        <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                                            Page {accountPage} of {accountTotalPages}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAccountPage((current) => Math.min(accountTotalPages, current + 1))}
                                                            disabled={accountPage === accountTotalPages}
                                                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </>
                        ) : activeTab === '__database_disabled__' ? (
                            <>
                                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Manage Database Structure and Backups</h2>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Maintain schema history records and backup lifecycle entries from one operational console.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={loadDatabaseAdminData}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${databaseLoading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>

                                {databaseError ? (
                                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{databaseError}</span>
                                    </div>
                                ) : null}

                                {databaseLoading ? (
                                    <div className="mt-2 flex min-h-[320px] items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading database records...
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-6 xl:grid-cols-2">
                                        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4">
                                                <h3 className="text-lg font-black tracking-tight text-slate-900">Database Structure Registry</h3>
                                                <p className="mt-1 text-sm text-slate-600">Track schema versions, migration labels, and rollback notes.</p>
                                            </div>

                                            <form onSubmit={submitStructure} className="grid gap-3">
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <input
                                                        value={structureForm.name}
                                                        onChange={(event) => setStructureForm({ ...structureForm, name: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Record name"
                                                        required
                                                    />
                                                    <input
                                                        value={structureForm.schema_version}
                                                        onChange={(event) => setStructureForm({ ...structureForm, schema_version: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Schema version"
                                                        required
                                                    />
                                                </div>
                                                <input
                                                    value={structureForm.migration_label}
                                                    onChange={(event) => setStructureForm({ ...structureForm, migration_label: event.target.value })}
                                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    placeholder="Migration label (optional)"
                                                />
                                                <textarea
                                                    value={structureForm.change_summary}
                                                    onChange={(event) => setStructureForm({ ...structureForm, change_summary: event.target.value })}
                                                    className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    placeholder="Change summary"
                                                />
                                                <textarea
                                                    value={structureForm.rollback_script}
                                                    onChange={(event) => setStructureForm({ ...structureForm, rollback_script: event.target.value })}
                                                    className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    placeholder="Rollback script notes"
                                                />
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={structureForm.applied_at}
                                                        onChange={(event) => setStructureForm({ ...structureForm, applied_at: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    />
                                                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                                                        Mark as current schema
                                                        <input
                                                            type="checkbox"
                                                            checked={structureForm.is_current}
                                                            onChange={(event) => setStructureForm({ ...structureForm, is_current: event.target.checked })}
                                                            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                                        />
                                                    </label>
                                                </div>

                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {editingStructureId ? (
                                                        <button
                                                            type="button"
                                                            onClick={resetStructureForm}
                                                            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Cancel edit
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="submit"
                                                        disabled={databaseSaving}
                                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                                                    >
                                                        {databaseSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        {editingStructureId ? 'Update record' : 'Create record'}
                                                    </button>
                                                </div>
                                            </form>

                                            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                                                {databaseStructures.length === 0 ? (
                                                    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">
                                                        <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                                                            <Database className="h-6 w-6" />
                                                        </div>
                                                        <h4 className="mt-4 text-base font-bold text-slate-900">No database structure records yet</h4>
                                                        <p className="mt-1 max-w-md text-sm text-slate-500">
                                                            Create the first schema entry to start tracking version history, migration labels, and rollback notes.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                                        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                                            <tr>
                                                                <th className="px-4 py-3">Version</th>
                                                                <th className="px-4 py-3">Migration</th>
                                                                <th className="px-4 py-3">Current</th>
                                                                <th className="px-4 py-3 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {databaseStructures.map((record) => (
                                                                <tr key={record.id}>
                                                                    <td className="px-4 py-3">
                                                                        <p className="font-semibold text-slate-900">{record.schema_version}</p>
                                                                        <p className="text-xs text-slate-500">{record.name}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600">{record.migration_label || '-'}</td>
                                                                    <td className="px-4 py-3">
                                                                        {record.is_current ? (
                                                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Current</span>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-500">No</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => editStructure(record)}
                                                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                            >
                                                                                <Edit2 className="h-3.5 w-3.5" />
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => deleteStructure(record.id)}
                                                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </section>

                                        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4">
                                                <h3 className="text-lg font-black tracking-tight text-slate-900">Backup Lifecycle Records</h3>
                                                <p className="mt-1 text-sm text-slate-600">Define and update backup policies, targets, and execution states.</p>
                                            </div>

                                            <form onSubmit={submitBackup} className="grid gap-3">
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <input
                                                        value={backupForm.name}
                                                        onChange={(event) => setBackupForm({ ...backupForm, name: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Backup name"
                                                        required
                                                    />
                                                    <select
                                                        value={backupForm.backup_type}
                                                        onChange={(event) => setBackupForm({ ...backupForm, backup_type: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                                    >
                                                        <option value="full">Full</option>
                                                        <option value="incremental">Incremental</option>
                                                        <option value="schema">Schema only</option>
                                                    </select>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <input
                                                        value={backupForm.target_environment}
                                                        onChange={(event) => setBackupForm({ ...backupForm, target_environment: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Environment (prod/staging/local)"
                                                    />
                                                    <input
                                                        value={backupForm.storage_location}
                                                        onChange={(event) => setBackupForm({ ...backupForm, storage_location: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Storage location"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="3650"
                                                        value={backupForm.retention_days}
                                                        onChange={(event) => setBackupForm({ ...backupForm, retention_days: Number(event.target.value) })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Retention days"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={backupForm.size_mb}
                                                        onChange={(event) => setBackupForm({ ...backupForm, size_mb: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="Size (MB)"
                                                    />
                                                    <select
                                                        value={backupForm.status}
                                                        onChange={(event) => setBackupForm({ ...backupForm, status: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                                    >
                                                        <option value="planned">Planned</option>
                                                        <option value="running">Running</option>
                                                        <option value="completed">Completed</option>
                                                        <option value="failed">Failed</option>
                                                    </select>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={backupForm.backup_started_at}
                                                        onChange={(event) => setBackupForm({ ...backupForm, backup_started_at: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    />
                                                    <input
                                                        type="datetime-local"
                                                        value={backupForm.backup_completed_at}
                                                        onChange={(event) => setBackupForm({ ...backupForm, backup_completed_at: event.target.value })}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    />
                                                </div>
                                                <textarea
                                                    value={backupForm.notes}
                                                    onChange={(event) => setBackupForm({ ...backupForm, notes: event.target.value })}
                                                    className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    placeholder="Notes"
                                                />

                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {editingBackupId ? (
                                                        <button
                                                            type="button"
                                                            onClick={resetBackupForm}
                                                            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                        >
                                                            Cancel edit
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="submit"
                                                        disabled={databaseSaving}
                                                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                                                    >
                                                        {databaseSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        {editingBackupId ? 'Update record' : 'Create record'}
                                                    </button>
                                                </div>
                                            </form>

                                            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                                                {backupRecords.length === 0 ? (
                                                    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">
                                                        <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                                                            <HardDriveDownload className="h-6 w-6" />
                                                        </div>
                                                        <h4 className="mt-4 text-base font-bold text-slate-900">No backup records yet</h4>
                                                        <p className="mt-1 max-w-md text-sm text-slate-500">
                                                            Create the first backup entry to document your backup plan, retention policy, and execution status.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                                        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                                            <tr>
                                                                <th className="px-4 py-3">Backup</th>
                                                                <th className="px-4 py-3">Type</th>
                                                                <th className="px-4 py-3">Status</th>
                                                                <th className="px-4 py-3 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {backupRecords.map((record) => (
                                                                <tr key={record.id}>
                                                                    <td className="px-4 py-3">
                                                                        <p className="font-semibold text-slate-900">{record.name}</p>
                                                                        <p className="text-xs text-slate-500">{record.storage_location}</p>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600">{record.backup_type}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === 'completed' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : record.status === 'failed' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                                                                            {record.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => editBackup(record)}
                                                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                            >
                                                                                <Edit2 className="h-3.5 w-3.5" />
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => deleteBackup(record.id)}
                                                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </>
                        ) : activeTab === 'security' ? (
                            <>
                                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">System Logs</h2>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Automatic activity and error logs for every API request and administrative action.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={loadSystemLogs}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                                    >
                                        <RefreshCw className={`h-4 w-4 ${securityLoading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <Search className="h-4 w-4 text-slate-400" />
                                        <input
                                            value={systemLogSearch}
                                            onChange={(event) => setSystemLogSearch(event.target.value)}
                                            placeholder="Search actor, endpoint, or message"
                                            className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                        />
                                    </label>
                                    <select
                                        value={systemLogSeverity}
                                        onChange={(event) => setSystemLogSeverity(event.target.value)}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                    >
                                        <option value="all">All severities</option>
                                        <option value="info">Info</option>
                                        <option value="warning">Warning</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                    <select
                                        value={systemLogOutcome}
                                        onChange={(event) => setSystemLogOutcome(event.target.value)}
                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                    >
                                        <option value="all">All outcomes</option>
                                        <option value="success">Success</option>
                                        <option value="blocked">Blocked</option>
                                        <option value="failure">Failure</option>
                                    </select>
                                </div>

                                {securityError ? (
                                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{securityError}</span>
                                    </div>
                                ) : null}

                                {securityLoading ? (
                                    <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading system logs...
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                                        {filteredSystemLogs.length === 0 ? (
                                            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                                                <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                                                    <AlertCircle className="h-8 w-8" />
                                                </div>
                                                <h3 className="mt-4 text-lg font-bold text-slate-900">No system logs found</h3>
                                                <p className="mt-2 max-w-md text-sm text-slate-500">
                                                    Adjust your filters or wait for new activity to appear in the log stream.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-slate-200">
                                                        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                                            <tr>
                                                                <th className="px-6 py-4">Activity</th>
                                                                <th className="px-6 py-4">Actor</th>
                                                                <th className="px-6 py-4">Type</th>
                                                                <th className="px-6 py-4">Severity</th>
                                                                <th className="px-6 py-4">Outcome</th>
                                                                <th className="px-6 py-4">When</th>
                                                                <th className="px-6 py-4">IP</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {paginatedSystemLogs.map((record) => (
                                                                <tr key={record.id} className="transition hover:bg-slate-50/70">
                                                                    <td className="px-6 py-5 align-top">
                                                                        <p className="text-sm font-semibold text-slate-900">
                                                                            {record.action_summary || 'System activity'}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500 break-all">
                                                                            {record.target_label || record.notes || '-'}
                                                                        </p>
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top text-sm text-slate-600">
                                                                        {record.actor_label || 'Unknown'}
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top text-sm text-slate-600">
                                                                        {formatChoiceLabel(record.event_type)}
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top">
                                                                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${record.severity === 'critical'
                                                                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                                            : record.severity === 'warning'
                                                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                                                : 'border-sky-200 bg-sky-50 text-sky-700'
                                                                        }`}>
                                                                            {formatChoiceLabel(record.severity)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top">
                                                                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${record.outcome === 'success'
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                            : record.outcome === 'blocked'
                                                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                                                : 'border-rose-200 bg-rose-50 text-rose-700'
                                                                        }`}>
                                                                            {formatChoiceLabel(record.outcome)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top text-sm text-slate-600">
                                                                        {formatDateTime(record.occurred_at || record.created_at)}
                                                                    </td>
                                                                    <td className="px-6 py-5 align-top text-sm text-slate-600">
                                                                        {record.ip_address || 'n/a'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {filteredSystemLogs.length > SYSTEM_LOG_PAGE_SIZE ? (
                                                    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <p className="text-sm text-slate-600">
                                                            Showing {((systemLogPage - 1) * SYSTEM_LOG_PAGE_SIZE) + 1}-{Math.min(systemLogPage * SYSTEM_LOG_PAGE_SIZE, filteredSystemLogs.length)} of {filteredSystemLogs.length} events
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSystemLogPage((current) => Math.max(1, current - 1))}
                                                                disabled={systemLogPage === 1}
                                                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                                                Page {systemLogPage} of {systemLogTotalPages}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSystemLogPage((current) => Math.min(systemLogTotalPages, current + 1))}
                                                                disabled={systemLogPage === systemLogTotalPages}
                                                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : activeTab === 'system' ? (
                            <>
                                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Configure System Settings</h2>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Tune AI model parameters, ranking thresholds, filtering rules, and API integration endpoints.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={loadSettings}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${settingsLoading ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                        <button
                                            type="submit"
                                            form="system-settings-form"
                                            disabled={settingsSaving || settingsLoading}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                            {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            Save changes
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI model</p>
                                        <p className="mt-2 text-lg font-black text-slate-900">{systemSettings.ai_model_settings.generation_model}</p>
                                        <p className="mt-1 text-sm text-slate-600">Provider: {systemSettings.ai_model_settings.provider}</p>
                                    </div>
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ranking</p>
                                        <p className="mt-2 text-lg font-black text-slate-900">{systemSettings.search_settings.ranking_strategy}</p>
                                        <p className="mt-1 text-sm text-slate-600">Result limit {systemSettings.search_settings.result_limit} · Threshold {systemSettings.search_settings.distance_threshold}</p>
                                    </div>
                                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Environment Config</p>
                                        <p className="mt-2 text-lg font-black text-slate-900">{configuredIntegrations} configured</p>
                                        <p className="mt-1 text-sm text-slate-600">Last saved {formatDateTime(settingsUpdatedAt)}</p>
                                    </div>
                                </div>

                                {settingsLoading ? (
                                    <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading system settings...
                                        </div>
                                    </div>
                                ) : (
                                    <form id="system-settings-form" onSubmit={submitSystemSettings} className="mt-6 grid gap-6 xl:grid-cols-3">
                                        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
                                            <div>
                                                <h3 className="text-lg font-black tracking-tight text-slate-900">AI Model Parameters</h3>
                                                <p className="mt-1 text-sm text-slate-600">Set the generation and rewriting models used by the RAG pipeline.</p>
                                            </div>

                                            <div className="mt-5 grid gap-4">
                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Provider</span>
                                                    <input
                                                        value={systemSettings.ai_model_settings.provider}
                                                        onChange={(event) => updateSystemSection('ai_model_settings', 'provider', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="gemini"
                                                    />
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Generation model</span>
                                                    <input
                                                        value={systemSettings.ai_model_settings.generation_model}
                                                        onChange={(event) => updateSystemSection('ai_model_settings', 'generation_model', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="gemini-2.5-flash"
                                                    />
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Rewrite model</span>
                                                    <input
                                                        value={systemSettings.ai_model_settings.rewrite_model}
                                                        onChange={(event) => updateSystemSection('ai_model_settings', 'rewrite_model', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="gemini-2.5-flash-lite"
                                                    />
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Rerank model</span>
                                                    <input
                                                        value={systemSettings.ai_model_settings.rerank_model}
                                                        onChange={(event) => updateSystemSection('ai_model_settings', 'rerank_model', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="gemini-2.5-flash"
                                                    />
                                                </label>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Temperature</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="2"
                                                            step="0.1"
                                                            value={systemSettings.ai_model_settings.temperature}
                                                            onChange={(event) => updateSystemSection('ai_model_settings', 'temperature', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>

                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Top-p</span>
                                                        <input
                                                            type="number"
                                                            min="0.1"
                                                            max="1"
                                                            step="0.05"
                                                            value={systemSettings.ai_model_settings.top_p}
                                                            onChange={(event) => updateSystemSection('ai_model_settings', 'top_p', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>
                                                </div>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Max output tokens</span>
                                                    <input
                                                        type="number"
                                                        min="64"
                                                        max="8192"
                                                        step="64"
                                                        value={systemSettings.ai_model_settings.max_output_tokens}
                                                        onChange={(event) => updateSystemSection('ai_model_settings', 'max_output_tokens', Number(event.target.value))}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                    />
                                                </label>
                                            </div>
                                        </section>

                                        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
                                            <div>
                                                <h3 className="text-lg font-black tracking-tight text-slate-900">Search & Recommendation Logic</h3>
                                                <p className="mt-1 text-sm text-slate-600">Control ranking strategy, result thresholds, and filtering rules.</p>
                                            </div>

                                            <div className="mt-5 grid gap-4">
                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Ranking strategy</span>
                                                    <select
                                                        value={systemSettings.search_settings.ranking_strategy}
                                                        onChange={(event) => updateSystemSection('search_settings', 'ranking_strategy', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none"
                                                    >
                                                        <option value="hybrid">Hybrid</option>
                                                        <option value="semantic">Semantic</option>
                                                        <option value="keyword">Keyword</option>
                                                        <option value="rerank">Rerank only</option>
                                                    </select>
                                                </label>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Result limit</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="50"
                                                            step="1"
                                                            value={systemSettings.search_settings.result_limit}
                                                            onChange={(event) => updateSystemSection('search_settings', 'result_limit', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>

                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Rerank top-k</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="50"
                                                            step="1"
                                                            value={systemSettings.search_settings.rerank_top_k}
                                                            onChange={(event) => updateSystemSection('search_settings', 'rerank_top_k', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Distance threshold</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="5"
                                                            step="0.1"
                                                            value={systemSettings.search_settings.distance_threshold}
                                                            onChange={(event) => updateSystemSection('search_settings', 'distance_threshold', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>

                                                    <label className="grid gap-2">
                                                        <span className="text-sm font-semibold text-slate-700">Relevance floor</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="1"
                                                            step="0.05"
                                                            value={systemSettings.search_settings.relevance_floor}
                                                            onChange={(event) => updateSystemSection('search_settings', 'relevance_floor', Number(event.target.value))}
                                                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        />
                                                    </label>
                                                </div>

                                                <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                                    <label className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-sm font-semibold text-slate-700">Enable subject filters</span>
                                                            <p className="text-xs text-slate-500">Use subject metadata when narrowing recommendations.</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(systemSettings.search_settings.enable_subject_filters)}
                                                            onChange={(event) => updateSystemSection('search_settings', 'enable_subject_filters', event.target.checked)}
                                                            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-sm font-semibold text-slate-700">Enable year filters</span>
                                                            <p className="text-xs text-slate-500">Allow date-range constraints in search and ranking.</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(systemSettings.search_settings.enable_year_filters)}
                                                            onChange={(event) => updateSystemSection('search_settings', 'enable_year_filters', event.target.checked)}
                                                            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-sm font-semibold text-slate-700">Enable strict matching</span>
                                                            <p className="text-xs text-slate-500">Keep the final relevance filter conservative for direct queries.</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(systemSettings.search_settings.enable_strict_matching)}
                                                            onChange={(event) => updateSystemSection('search_settings', 'enable_strict_matching', event.target.checked)}
                                                            className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
                                            <div>
                                                <h3 className="text-lg font-black tracking-tight text-slate-900">Environment Configuration</h3>
                                                <p className="mt-1 text-sm text-slate-600">Deployment secrets and API credentials. Keep sensitive values secure in production.</p>
                                            </div>

                                            <div className="mt-5 grid gap-4">
                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Database URL</span>
                                                    <input
                                                        type="password"
                                                        value={systemSettings.environment_config.database_url}
                                                        onChange={(event) => updateSystemSection('environment_config', 'database_url', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="postgresql://user:pass@host:port/db"
                                                    />
                                                    <p className="text-xs text-slate-500">⚠️ Change in code environment variable: DATABASE_URL</p>
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Email Host User</span>
                                                    <input
                                                        type="password"
                                                        value={systemSettings.environment_config.email_host_user}
                                                        onChange={(event) => updateSystemSection('environment_config', 'email_host_user', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="your-email@gmail.com"
                                                    />
                                                    <p className="text-xs text-slate-500">⚠️ Change in code environment variable: EMAIL_HOST_USER</p>
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Email Host Password</span>
                                                    <input
                                                        type="password"
                                                        value={systemSettings.environment_config.email_host_password}
                                                        onChange={(event) => updateSystemSection('environment_config', 'email_host_password', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="••••••••"
                                                    />
                                                    <p className="text-xs text-slate-500">⚠️ Change in code environment variable: EMAIL_HOST_PASSWORD</p>
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">Gemini API Key</span>
                                                    <input
                                                        type="password"
                                                        value={systemSettings.environment_config.gemini_api_key}
                                                        onChange={(event) => updateSystemSection('environment_config', 'gemini_api_key', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="••••••••"
                                                    />
                                                    <p className="text-xs text-slate-500">⚠️ Change in code environment variable: GEMINI_API_KEY</p>
                                                </label>

                                                <label className="grid gap-2">
                                                    <span className="text-sm font-semibold text-slate-700">HuggingFace Token</span>
                                                    <input
                                                        type="password"
                                                        value={systemSettings.environment_config.hf_token}
                                                        onChange={(event) => updateSystemSection('environment_config', 'hf_token', event.target.value)}
                                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                                        placeholder="••••••••"
                                                    />
                                                    <p className="text-xs text-slate-500">⚠️ Change in code environment variable: HF_TOKEN</p>
                                                </label>
                                            </div>

                                            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                ⚠️ <strong>Security Note:</strong> These values are stored in the database. Update corresponding environment variables in your deployment configuration (e.g., Railway, Heroku, .env files) to ensure consistency.
                                            </p>
                                        </section>

                                        {settingsError ? (
                                            <div className="xl:col-span-3 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                <span>{settingsError}</span>
                                            </div>
                                        ) : null}

                                        <div className="xl:col-span-3 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
                                            <button
                                                type="button"
                                                onClick={loadSettings}
                                                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                            >
                                                Reset from server
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={settingsSaving || settingsLoading}
                                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Save settings
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
                </div>
                </main>
            </div>

            {toast.show ? (
                <div className={`fixed right-4 top-4 z-50 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4" />
                        <span className="text-sm font-medium">{toast.message}</span>
                    </div>
                </div>
            ) : null}

            {isModalOpen ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">User management</p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                    {editingAccount ? 'Edit user account' : 'Create user account'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    {editingAccount ? 'Update identity, role, status, or reset the password.' : 'Create a new account and assign the correct role from day one.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={submitForm} className="grid gap-5 px-6 py-6 md:grid-cols-2">
                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-slate-700">Full name</span>
                                <input
                                    value={form.full_name}
                                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                    placeholder="Jane Doe"
                                />
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-slate-700">Username</span>
                                <input
                                    value={form.username}
                                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                    placeholder="jane.doe"
                                    required
                                />
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-slate-700">Email</span>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                    placeholder="user@example.com"
                                    required
                                />
                            </label>

                            <label className="grid gap-2">
                                <span className="text-sm font-semibold text-slate-700">Role</span>
                                <select
                                    value={form.role}
                                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                >
                                    {roleOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <div className="md:col-span-2">
                                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                                    <div>
                                        <span className="text-sm font-semibold text-slate-700">Account active</span>
                                        <p className="text-xs text-slate-500">Inactive accounts cannot sign in until reactivated.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                                        className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    />
                                </label>
                            </div>

                            <div className="md:col-span-2 grid gap-2">
                                <label className="grid gap-2">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <KeyRound className="h-4 w-4" />
                                        {editingAccount ? 'New password (optional)' : 'Password'}
                                    </span>
                                    <input
                                        type="password"
                                        value={form.password}
                                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                        placeholder="Enter a strong password"
                                        required={!editingAccount}
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <span className="text-sm font-semibold text-slate-700">Confirm password</span>
                                    <input
                                        type="password"
                                        value={form.confirmPassword}
                                        onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                                        placeholder="Re-enter the password"
                                        required={!editingAccount || Boolean(form.password)}
                                    />
                                </label>
                            </div>

                            <div className="md:col-span-2 mt-2">
                                <PasswordRequirements checks={passwordChecks} />
                            </div>

                            {pageError ? (
                                <div className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{pageError}</span>
                                </div>
                            ) : null}

                            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {editingAccount ? 'Save changes' : 'Create account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ITAdminDashboard;
