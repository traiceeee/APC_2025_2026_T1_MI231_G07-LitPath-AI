// @ts-nocheck
/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, react/no-unescaped-entities, jsx-a11y/no-autofocus, jsx-a11y/anchor-is-valid, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/img-redundant-alt */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
    LayoutDashboard, MessageSquare, Star, LogOut, Settings,
    ShieldCheck, ChevronDown, Eye, Search, ThumbsUp, ThumbsDown,
    Clock, Bookmark, AlertCircle, TrendingUp, BookOpen, CheckCircle,
    X, EyeOff, Menu, Calendar, Users, ChevronLeft, ChevronRight,
    Trophy, Medal, Briefcase, GraduationCap, BarChart3, Copy, Info,
    User, Key, RefreshCw, Download, Home, Archive
} from "lucide-react";
import dostLogo from "../../assets/images/dost-logo.png";
import { API_BASE_URL, apiHeaders } from '../../services/api';
import { formatNumber } from '../../lib/formatNumber';
import { getPasswordRequirementChecks, validatePasswordStrength } from '../../lib/passwordValidation';
import PasswordRequirements from '../../components/PasswordRequirements';
import { getRoleLabel, ROLE_PATHS } from '../../lib/roleLabels';

const hideDefaultPasswordEyeStyles = `
  input[type="password"]::-webkit-credentials-auto-fill-button,
  input[type="password"]::-webkit-outer-spin-button,
  input[type="password"]::-webkit-inner-spin-button {
    display: none !important;
  }
  input[type="password"]::-ms-reveal,
  input[type="password"]::-ms-clear {
    display: none !important;
  }
`;

const AdminDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { logout, user, changePassword, updateProfile } = useAuth();
    const roleLabel = getRoleLabel(user?.role);

    // ---------- Tab State from URL ----------
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

    // ---------- Dashboard Parent Expand/Collapse State ----------
    const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);

    // ---------- UI State ----------
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);
    const [error, setError] = useState(null); // Error state for dashboard data fetching

    // ---------- Overview Date Filter (unified for all dashboard data) ----------
    const overviewDateFilterOptions = ['Year', 'Month', 'Last 7 days', 'Custom range'];
    const [overviewDateFilterType, setOverviewDateFilterType] = useState('Year');
    const [overviewSelectedYear, setOverviewSelectedYear] = useState(new Date().getFullYear());
    const [overviewSelectedMonth, setOverviewSelectedMonth] = useState(new Date().getMonth() + 1);
    const [overviewSelectedMonthYear, setOverviewSelectedMonthYear] = useState(new Date().getFullYear());
    const [overviewCustomFrom, setOverviewCustomFrom] = useState('');
    const [overviewCustomTo, setOverviewCustomTo] = useState('');
    const [showOverviewDateDropdown, setShowOverviewDateDropdown] = useState(false);
    const overviewDateDropdownRef = useRef(null);

    // ---------- Data States ----------
    const [dashboardData, setDashboardData] = useState({
        kpi: { totalDocuments: 0, failedQueriesCount: 0, totalSearches: 0, accessedDocuments: 0, utilizationPercent: 0, avgResponseTime: 0 },
        trendingTopics: [],
        topTheses: [],
        usageByCategory: [],
        genderDistribution: [],
        citationTrends: [],
        citationStats: { total_copies: 0, top_cited: [] },
        trends: [], // for activity trends (monthly/weekly/daily)
        failedQueries: [] // for failed queries with details
    });
    const [loading, setLoading] = useState(false);

    // ---------- Feedback States ----------
    const [feedbacks, setFeedbacks] = useState([]);
    const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('All');
    const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('All');

    // ---------- Feedback Manager Date Filter ----------
    const feedbackDateFilterOptions = ['All', 'Year', 'Month', 'Last 7 days', 'Custom range'];
    const [feedbackDateFilterType, setFeedbackDateFilterType] = useState('All');
    const [feedbackSelectedYear, setFeedbackSelectedYear] = useState(new Date().getFullYear());
    const [feedbackSelectedMonth, setFeedbackSelectedMonth] = useState(new Date().getMonth() + 1);
    const [feedbackSelectedMonthYear, setFeedbackSelectedMonthYear] = useState(new Date().getFullYear());
    const [feedbackCustomFrom, setFeedbackCustomFrom] = useState('');
    const [feedbackCustomTo, setFeedbackCustomTo] = useState('');
    const [showFeedbackDateDropdown, setShowFeedbackDateDropdown] = useState(false);
    const feedbackDateDropdownRef = useRef(null);

    const clientTypeFilterOptions = ['Student', 'DOST Employee', 'Other Government Employee', 'Librarian/Library Staff', 'Teaching Personnel', 'Administrative Personnel', 'Researcher', 'Others'];

    // ---------- Feedback Manager Client Type & Status Filters ----------
    const [showClientTypeDropdown, setShowClientTypeDropdown] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const clientTypeDropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);

    // ---------- Export Dropdown ----------
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const exportDropdownRef = useRef(null);

    // ---------- Chart Refs for PDF Export ----------
    const activityTrendsChartRef = useRef(null);
    const citationActivityChartRef = useRef(null);
    const usersByCategoryChartRef = useRef(null);
    const genderDistributionChartRef = useRef(null);
    const ratingDistributionChartRef = useRef(null);
    const ratingTrendChartRef = useRef(null);

    // ---------- Feedback Export Dropdown ----------
    const [showFeedbackExportDropdown, setShowFeedbackExportDropdown] = useState(false);
    const feedbackExportDropdownRef = useRef(null);

    // ---------- Ratings Export Dropdown ----------
    const [showRatingsExportDropdown, setShowRatingsExportDropdown] = useState(false);
    const ratingsExportDropdownRef = useRef(null);

    // ---------- Ratings Filter Dropdown ----------
    const [showRatingDropdown, setShowRatingDropdown] = useState(false);
    const ratingDropdownRef = useRef(null);

    // ---------- Feedback Manager Pagination ----------
    const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1);
    const feedbackItemsPerPage = 10;

    // ---------- Material Ratings ----------
    const [materialRatings, setMaterialRatings] = useState([]);

    // ---------- Material Ratings: interactive filter ----------
    const [selectedMaterialFilter, setSelectedMaterialFilter] = useState(null);
    const feedbackLogRef = useRef(null);

    // ---------- Dormant Materials Count ----------
    const [dormantCount, setDormantCount] = useState(0);

    // ---------- Top Rated Modal ----------
    const [showTopicMaterialsModal, setShowTopicMaterialsModal] = useState(false);
    const [selectedTopicName, setSelectedTopicName] = useState('');
    const [selectedTopicViewCount, setSelectedTopicViewCount] = useState(0);
    const [topicMaterials, setTopicMaterials] = useState([]);

    // ---------- Most Viewed Theses ----------
    const [showAllThesesModal, setShowAllThesesModal] = useState(false);
    const [allTheses, setAllTheses] = useState([]);
    const [allThesesLoading, setAllThesesLoading] = useState(false);

    // ---------- Gender Distribution ----------
    const [showGenderDetailModal, setShowGenderDetailModal] = useState(false);
    const [selectedGenderItem, setSelectedGenderItem] = useState(null);
    const [hoveredGenderSegment, setHoveredGenderSegment] = useState(null);

    // ---------- Top Failed Queries ----------
    const [showAllFailedQueriesModal, setShowAllFailedQueriesModal] = useState(false);
    const [allFailedQueries, setAllFailedQueries] = useState([]);
    const [allFailedQueriesLoading, setAllFailedQueriesLoading] = useState(false);

    // ---------- Activity Trends ----------
    const [showActivityTrendDetailModal, setShowActivityTrendDetailModal] = useState(false);
    const [selectedActivityBucket, setSelectedActivityBucket] = useState(null);
    const [activityBucketMaterials, setActivityBucketMaterials] = useState([]);
    const [activityBucketLoading, setActivityBucketLoading] = useState(false);

    // ---------- Citation Activity ----------
    const [showCitationDetailModal, setShowCitationDetailModal] = useState(false);
    const [selectedCitationBucket, setSelectedCitationBucket] = useState(null);
    const [citationBucketMaterials, setCitationBucketMaterials] = useState([]);
    const [citationBucketLoading, setCitationBucketLoading] = useState(false);

    // ---------- Material Ratings Date Filter ----------
    const ratingsDateFilterOptions = ['All', 'Year', 'Month', 'Last 7 days', 'Custom range'];
    const [ratingsDateFilterType, setRatingsDateFilterType] = useState('All');
    const [ratingsSelectedYear, setRatingsSelectedYear] = useState(new Date().getFullYear());
    const [ratingsSelectedMonth, setRatingsSelectedMonth] = useState(new Date().getMonth() + 1);
    const [ratingsSelectedMonthYear, setRatingsSelectedMonthYear] = useState(new Date().getFullYear());
    const [ratingsCustomFrom, setRatingsCustomFrom] = useState('');
    const [ratingsCustomTo, setRatingsCustomTo] = useState('');
    const [showRatingsDateDropdown, setShowRatingsDateDropdown] = useState(false);
    const ratingsDateDropdownRef = useRef(null);

    // ---------- Least Accessed Materials ----------
    const [leastAccessedMaterials, setLeastAccessedMaterials] = useState([]);

    // ---------- Account Settings ----------
    const [showAccountSettings, setShowAccountSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('profile');

    // ---------- Dormant Materials Modal ----------
    const [showDormantMaterialsModal, setShowDormantMaterialsModal] = useState(false);
    const [dormantMaterialsList, setDormantMaterialsList] = useState([]);
    const [showVotesModal, setShowVotesModal] = useState(false);
    const [showHelpfulModal, setShowHelpfulModal] = useState(false);
    const [showNotRelevantModal, setShowNotRelevantModal] = useState(false);
    const [showRelevanceScoreModal, setShowRelevanceScoreModal] = useState(false);
    const [showRatingTrendDetailModal, setShowRatingTrendDetailModal] = useState(false);
    const [selectedTrendBucket, setSelectedTrendBucket] = useState(null);
    const [showTopRatedModal, setShowTopRatedModal] = useState(false);
    const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
    const [archiveTargetMaterial, setArchiveTargetMaterial] = useState(null);
    const [hoveredSegment, setHoveredSegment] = useState<"helpful" | "notRelevant" | null>(null);

    // ---------- Feedback Details Modal ----------
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [isEditingFeedback, setIsEditingFeedback] = useState(false);
    const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
    const [feedbackEditForm, setFeedbackEditForm] = useState({
        status: '',
        admin_category: '',
        is_valid: null,
        validity_remarks: '',
        is_doable: null,
        feasibility_remarks: ''
    });
    const [editFullName, setEditFullName] = useState(user?.full_name || '');
    const [editUsername, setEditUsername] = useState(user?.username || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const passwordChecks = getPasswordRequirementChecks(newPassword);

    // ---------- Year options for dropdowns ----------
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let y = 2020; y <= currentYear + 1; y++) {
        yearOptions.push(y);
    }

    // Real‑time clock state
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
    const timer = setInterval(() => {
        setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
    }, []);

    // ---------- Date Range Helper for Overview (Fixed Timezone Issue) ----------
    const getDateRange = () => {
        const today = new Date();
        
        // Helper to format date as YYYY-MM-DD in LOCAL time, not UTC
        const formatDateLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (overviewDateFilterType === 'Year') {
            return { from: `${overviewSelectedYear}-01-01`, to: `${overviewSelectedYear}-12-31` };
        }
        if (overviewDateFilterType === 'Month') {
            const firstDay = new Date(overviewSelectedMonthYear, overviewSelectedMonth - 1, 1);
            const lastDay = new Date(overviewSelectedMonthYear, overviewSelectedMonth, 0);
            return {
                from: formatDateLocal(firstDay),
                to: formatDateLocal(lastDay)
            };
        }
        if (overviewDateFilterType === 'Last 7 days') {
            const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return {
                from: formatDateLocal(from),
                to: formatDateLocal(today)
            };
        }
        if (overviewDateFilterType === 'Custom range') {
            return { from: overviewCustomFrom, to: overviewCustomTo };
        }
        return { from: '', to: '' };
    };

    // ---------- Date Range Helper for Feedback ----------
    const isFeedbackInDateRange = (feedbackDate) => {
        if (feedbackDateFilterType === 'All') return true;
        
        const date = new Date(feedbackDate);
        const today = new Date();
        
        if (feedbackDateFilterType === 'Year') {
            return date.getFullYear() === feedbackSelectedYear;
        }
        
        if (feedbackDateFilterType === 'Last 7 days') {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date >= weekAgo;
        }
        
        if (feedbackDateFilterType === 'Month') {
            return date.getMonth() + 1 === feedbackSelectedMonth && 
                date.getFullYear() === feedbackSelectedMonthYear;
        }
        
        if (feedbackDateFilterType === 'Custom range') {
            if (!feedbackCustomFrom || !feedbackCustomTo) return true;
            const from = new Date(feedbackCustomFrom);
            const to = new Date(feedbackCustomTo);
            to.setHours(23, 59, 59, 999);
            return date >= from && date <= to;
        }
        
        return true;
    };

    // ---------- Date Range Helper for Material Ratings ----------
    const isRatingInDateRange = (ratingDate) => {
        if (ratingsDateFilterType === 'All') return true;
        
        const date = new Date(ratingDate);
        const today = new Date();
        
        if (ratingsDateFilterType === 'Year') {
            return date.getFullYear() === ratingsSelectedYear;
        }
        
        if (ratingsDateFilterType === 'Last 7 days') {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date >= weekAgo;
        }
        
        if (ratingsDateFilterType === 'Month') {
            return date.getMonth() + 1 === ratingsSelectedMonth && 
                date.getFullYear() === ratingsSelectedMonthYear;
        }
        
        if (ratingsDateFilterType === 'Custom range') {
            if (!ratingsCustomFrom || !ratingsCustomTo) return true;
            const from = new Date(ratingsCustomFrom);
            const to = new Date(ratingsCustomTo);
            to.setHours(23, 59, 59, 999);
            return date >= from && date <= to;
        }
        
        return true;
    };

    const getTrendBarDateRange = (item) => {
        const formatDateLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (overviewDateFilterType === 'Year') {
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            let monthIndex = monthNames.findIndex(m => m.toLowerCase() === String(item.month).toLowerCase());
            if (monthIndex === -1) {
                // Try abbreviated match (e.g. "Mar")
                monthIndex = monthNames.findIndex(m => m.slice(0, 3).toLowerCase() === String(item.month).slice(0, 3).toLowerCase());
            }
            if (monthIndex === -1) {
                console.error('Could not parse month from item.month:', item.month);
                return { from: null, to: null };
            }
            const start = new Date(item.year, monthIndex, 1);
            const end = new Date(item.year, monthIndex + 1, 0);
            return { from: formatDateLocal(start), to: formatDateLocal(end) };
        }
        if (overviewDateFilterType === 'Month') {
            return { from: item.week_start, to: item.week_end };
        }
        if (overviewDateFilterType === 'Last 7 days') {
            return { from: item.day, to: item.day };
        }
        if (overviewDateFilterType === 'Custom range') {
            return { from: item.bucketStart, to: item.bucketEnd };
        }
        return { from: null, to: null };
    };

    const getCitationPointDateRange = (item) => {
        const formatDateLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (overviewDateFilterType === 'Year') {
            const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            let monthIndex = monthNames.findIndex(m => m.toLowerCase() === String(item.month).toLowerCase());
            if (monthIndex === -1) {
                monthIndex = monthNames.findIndex(m => m.slice(0, 3).toLowerCase() === String(item.month).slice(0, 3).toLowerCase());
            }
            if (monthIndex === -1) return { from: null, to: null };
            const start = new Date(item.year, monthIndex, 1);
            const end = new Date(item.year, monthIndex + 1, 0);
            return { from: formatDateLocal(start), to: formatDateLocal(end) };
        }
        if (overviewDateFilterType === 'Month') {
            return { from: item.week_start, to: item.week_end };
        }
        if (overviewDateFilterType === 'Last 7 days') {
            return { from: item.day, to: item.day };
        }
        if (overviewDateFilterType === 'Custom range') {
            return { from: item.day || null, to: item.day || null };
        }
        return { from: null, to: null };
    };

    // ---------- OVERVIEW DASHBOARD FETCH FUNCTIONS (all use getDateRange()) ----------
    const fetchDashboardKPI = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/kpi/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, kpi: data }));
            }
        } catch (error) { console.error("KPI fetch error:", error); }
    };

    const fetchTrendingTopics = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/trending-topics/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, trendingTopics: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchTopTheses = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/top-theses/?from=${from}&to=${to}&limit=8`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, topTheses: data.materials || [] }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchUsageByCategory = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/usage-by-category/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, usageByCategory: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchGenderDistribution = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/gender-distribution/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, genderDistribution: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchFailedQueriesCount = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/failed-queries-count/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, failedQueriesCount: data.total }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchFailedQueriesDetails = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/failed-queries-details/?from=${from}&to=${to}&limit=10`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, failedQueries: data.failed_queries || [] }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchCitationStats = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/citation-stats/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDashboardData(prev => ({ ...prev, citationStats: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchCitationTrends = async () => {
        const { from, to } = getDateRange();
        if (!from || !to) return;

        let endpoint = '';
        if (overviewDateFilterType === 'Year') {
            endpoint = '/dashboard/citation-monthly/';
        } else if (overviewDateFilterType === 'Month') {
            endpoint = '/dashboard/citation-weekly/';
        } else if (overviewDateFilterType === 'Last 7 days' || overviewDateFilterType === 'Custom range') {
            endpoint = '/dashboard/citation-daily/';
        }

        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                let data = await res.json();

                // Format data identical to Activity Trends
                if (overviewDateFilterType === 'Month') {
                    data = data.map((item, index) => ({
                        ...item,
                        displayLabel: `W${index + 1}`,
                        tooltipRange: item.label
                    }));
                } else if (overviewDateFilterType === 'Last 7 days') {
                    data = data.map(item => {
                        const date = new Date(item.day);
                        return {
                            ...item,
                            displayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
                            tooltipRange: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        };
                    });
                } else if (overviewDateFilterType === 'Custom range') {
                    if (data.length === 0) {
                        setDashboardData(prev => ({ ...prev, citationTrends: [] }));
                        return;
                    }
                    const totalDays = data.length;
                    let intervalSize = 1;
                    if (totalDays > 30) intervalSize = 5;
                    else if (totalDays > 15) intervalSize = 3;
                    else intervalSize = 2;

                    const grouped = [];
                    for (let i = 0; i < data.length; i += intervalSize) {
                        const groupItems = data.slice(i, i + intervalSize);
                        const startDate = new Date(groupItems[0].day);
                        const endDate = new Date(groupItems[groupItems.length - 1].day);
                        const totalCopies = groupItems.reduce((sum, d) => sum + d.copies, 0);

                        const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const rangeLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;

                        grouped.push({
                            displayLabel: startLabel,
                            tooltipRange: rangeLabel,
                            copies: totalCopies,
                        });
                    }
                    data = grouped;
                } else {
                    // Year filter
                    data = data.map(item => ({
                        ...item,
                        displayLabel: item.month.substring(0, 3),
                        tooltipRange: `${item.month} ${item.year}`
                    }));
                }

                setDashboardData(prev => ({ ...prev, citationTrends: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchTrends = async () => {
        const { from, to } = getDateRange();
        if (!from || !to) return;

        let endpoint = '';
        if (overviewDateFilterType === 'Year') {
            endpoint = '/dashboard/monthly-trends/';
        } else if (overviewDateFilterType === 'Month') {
            endpoint = '/dashboard/weekly-trends/';
        } else if (overviewDateFilterType === 'Last 7 days') {
            endpoint = '/dashboard/daily-trends/';
        } else if (overviewDateFilterType === 'Custom range') {
            endpoint = '/dashboard/daily-trends/'; // we'll group the daily data
        }

        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                let data = await res.json();

                // Transform based on filter type
                if (overviewDateFilterType === 'Month') {
                    // Weekly data: each item has week_start, week_end, label, views
                    // We'll keep the label as "Week N" and store full range for tooltip
                    data = data.map((item, index) => ({
                        ...item,
                        label: `Week ${index + 1}`,
                        tooltipRange: item.label, // e.g., "Mar 01 - Mar 07"
                    }));
                } else if (overviewDateFilterType === 'Last 7 days') {
                    // Daily data: each item has day, label, views
                    data = data.map(item => {
                        const date = new Date(item.day);
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                        const fullDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        return {
                            ...item,
                            label: dayName,
                            fullDate: fullDate,
                            weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
                        };
                    });
                } else if (overviewDateFilterType === 'Custom range') {
                    // Group daily data into intervals
                    if (data.length === 0) {
                        setDashboardData(prev => ({ ...prev, trends: [] }));
                        return;
                    }

                    const totalDays = data.length;
                    let intervalSize = 1;
                    if (totalDays > 30) intervalSize = 5;
                    else if (totalDays > 15) intervalSize = 3;
                    else intervalSize = 2; // for shorter ranges, keep daily but we'll still group? Let's use 2 for >7 days.

                    const grouped = [];
                    for (let i = 0; i < data.length; i += intervalSize) {
                        const groupItems = data.slice(i, i + intervalSize);
                        const startDate = new Date(groupItems[0].day);
                        const endDate = new Date(groupItems[groupItems.length - 1].day);
                        const totalViews = groupItems.reduce((sum, d) => sum + d.views, 0);

                        const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const rangeLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;

                        grouped.push({
                            label: startLabel, // show only start date under bar
                            tooltipRange: rangeLabel,
                            views: totalViews,
                            bucketStart: groupItems[0].day,
                            bucketEnd: groupItems[groupItems.length - 1].day,
                        });
                    }
                    data = grouped;
                }
                // For Year, data already has month names and year; no transformation needed.

                setDashboardData(prev => ({ ...prev, trends: data }));
            }
        } catch (error) { console.error(error); }
    };

    const fetchAllDashboardData = () => {
        setLoading(true);
        setError(null); // Reset error before fetching

        Promise.all([
            fetchDashboardKPI(),
            fetchFailedQueriesCount(),
            fetchFailedQueriesDetails(),
            fetchTrendingTopics(),
            fetchTopTheses(),
            fetchUsageByCategory(),
            fetchGenderDistribution(),
            fetchCitationStats(),
            fetchCitationTrends(),
            fetchTrends()
        ])
        .then(() => {
            // Optional: Check if critical data is still zero/empty to infer a logic error
        })
        .catch((err) => {
            console.error("Dashboard load failed", err);
            setError("Usage analytics data could not be loaded at this time."); // <--- SET THE MESSAGE HERE
        })
        .finally(() => setLoading(false));
    };

    // ---------- Tab sync & data fetching ----------
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        
        // Navigate to new route-based paths
        const pathMap = {
            'overview': '/library-admin/dashboard/usage-analytics',
            'usage-analytics': '/library-admin/dashboard/usage-analytics',
            'feedback': '/library-admin/dashboard/feedback-manager',
            'ratings': '/library-admin/dashboard/material-ratings',
            'material-ratings': '/library-admin/dashboard/material-ratings'
        };
        
        const newPath = pathMap[tab] || '/library-admin/dashboard';
        navigate(newPath, { replace: false });
        
        // Auto-expand Dashboard parent if clicking on its children
        if (tab === 'overview' || tab === 'usage-analytics' || tab === 'ratings' || tab === 'material-ratings') {
            setIsDashboardExpanded(true);
        }
    };

    useEffect(() => {
        // Detect active tab from current route path
        const path = location.pathname;
        
        if (path.includes('/usage-analytics')) {
            setActiveTab('overview');
            setIsDashboardExpanded(true);
        } else if (path.includes('/feedback-manager')) {
            setActiveTab('feedback');
        } else if (path.includes('/material-ratings')) {
            setActiveTab('ratings');
            setIsDashboardExpanded(true);
        } else {
            // Default to overview for base dashboard path
            setActiveTab('overview');
        }
    }, [location.pathname]);

    useEffect(() => {
        if (activeTab === 'overview') {
            fetchAllDashboardData();
        }
        if (activeTab === 'feedback') fetchFeedback();
    }, [
        activeTab,
        overviewDateFilterType,
        overviewSelectedYear,
        overviewSelectedMonth,
        overviewSelectedMonthYear,
        overviewCustomFrom,
        overviewCustomTo
    ]);

    // ---------- Fetch ratings & least accessed when filters change ----------
    useEffect(() => {
        if (activeTab === 'ratings') {
            fetchMaterialRatings();
            fetchLeastAccessedMaterials();
            fetchDormantCount();
        }
    }, [activeTab]);


    // ---------- Click outside handlers ----------
    useEffect(() => {
        const handleClickOutside = (event) => {
            // User Menu
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
            // Feedback Date Dropdown
            if (feedbackDateDropdownRef.current && !feedbackDateDropdownRef.current.contains(event.target)) {
                const isInput = event.target.tagName === 'INPUT';
                if (!isInput) setShowFeedbackDateDropdown(false);
            }
            // Feedback Rating Filter
            if (ratingDropdownRef.current && !ratingDropdownRef.current.contains(event.target)) {
                setShowRatingDropdown(false);
            }
            // Overview Date Dropdown
            if (overviewDateDropdownRef.current && !overviewDateDropdownRef.current.contains(event.target)) {
                const isInput = event.target.tagName === 'INPUT';
                if (!isInput) setShowOverviewDateDropdown(false);
            }
            // Export Dropdown
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
                setShowExportDropdown(false);
            }
            // Feedback Export Dropdown
            if (feedbackExportDropdownRef.current && !feedbackExportDropdownRef.current.contains(event.target)) {
                setShowFeedbackExportDropdown(false);
            }
            // Ratings Export Dropdown
            if (ratingsExportDropdownRef.current && !ratingsExportDropdownRef.current.contains(event.target)) {
                setShowRatingsExportDropdown(false);
            }
            // Ratings Date Dropdown
            if (ratingsDateDropdownRef.current && !ratingsDateDropdownRef.current.contains(event.target)) {
                const isInput = event.target.tagName === 'INPUT'; 
                if (!isInput) setShowRatingsDateDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (user) {
            setEditFullName(user.full_name || '');
            setEditUsername(user.username || '');
        }
    }, [user]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentFeedbackPage(1);
    }, [feedbackCategoryFilter, feedbackStatusFilter, feedbackDateFilterType, feedbackSelectedYear, feedbackSelectedMonth, feedbackSelectedMonthYear, feedbackCustomFrom, feedbackCustomTo]);

    // ---------- Feedback & Ratings ----------
    const fetchFeedback = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/csm-feedback/`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            }
        } catch (error) { console.error("Failed to load feedback", error); }
        finally { setLoading(false); }
    };

    const fetchMaterialRatings = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/feedback/`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                const ratings = data.filter(item => item.relevant !== null);
                setMaterialRatings(ratings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeastAccessedMaterials = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/least-browsed/`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setLeastAccessedMaterials(data);
            }
        } catch (error) { console.error("Failed to load least accessed materials", error); }
    };

    const fetchDormantCount = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/dormant-count/`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                setDormantCount(data.count);
            }
        } catch (error) {
            console.error("Failed to fetch dormant count", error);
        }
    };

    // ---------- Toast ----------
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    // ---------- Account Handlers ----------
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            const result = await updateProfile({ full_name: editFullName, username: editUsername });
            if (result?.success) {
                showToast('Profile updated successfully!', 'success');
                setTimeout(() => setShowAccountSettings(false), 1500);
            } else {
                showToast(result?.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            showToast('An error occurred while updating profile', 'error');
        } finally {
            setSettingsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }
        const passwordValidationError = validatePasswordStrength(newPassword);
        if (passwordValidationError) {
            showToast(passwordValidationError, 'error');
            return;
        }
        setSettingsLoading(true);
        try {
            const result = await changePassword(currentPassword, newPassword);
            if (result?.success) {
                showToast('Password changed successfully!', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setShowAccountSettings(false), 1500);
            } else {
                showToast(result?.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            showToast('An error occurred while changing password', 'error');
        } finally {
            setSettingsLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    // Helper for Rank Icons
    const getRankIcon = (index) => {
        if (index === 0) return (
            <div className="bg-yellow-100 p-1.5 rounded-full border border-yellow-200 shadow-sm">
                <Trophy size={16} className="text-yellow-600"/>
            </div>
        );
        if (index === 1) return (
            <div className="bg-gray-100 p-1.5 rounded-full border border-gray-200 shadow-sm">
                <Medal size={16} className="text-gray-500" />
            </div>
        );
        if (index === 2) return (
            <div className="bg-orange-100 p-1.5 rounded-full border border-orange-200 shadow-sm">
                <Medal size={16} className="text-orange-600" />
            </div>
        );
        return (
            <div className="w-8 h-8 flex items-center justify-center font-bold text-gray-400 text-sm bg-gray-50 rounded-full border border-gray-100">
                #{index + 1}
            </div>
        );
    };

    // Helper to get filtered feedbacks based on current client type, status and date filters
    const getFilteredFeedbacks = () => {
        return feedbacks
            .filter(fb => feedbackCategoryFilter === 'All' || fb.client_type === feedbackCategoryFilter)
            .filter(fb => feedbackStatusFilter === 'All' || fb.status === feedbackStatusFilter)
            .filter(fb => isFeedbackInDateRange(fb.created_at));
    };

    const getDisplayClientType = (feedback) => {
        if (!feedback) return '—';
        if (feedback.display_client_type) return feedback.display_client_type;
        if (feedback.client_type === 'Others' && feedback.client_type_other) return feedback.client_type_other;
        return feedback.client_type || '—';
    };

    
    // ---------- Feedback Manager Export Data to CSV ----------
    const handleFeedbackExportCSV = () => {
        try {
            const filteredFeedbacks = getFilteredFeedbacks();
            if (filteredFeedbacks.length === 0) {
                showToast('No data to export', 'error');
                return;
            }

            // Determine filter description based on current feedback filter
            let filterDescription = '';
            if (feedbackDateFilterType === 'Year') {
                filterDescription = `Year ${feedbackSelectedYear}`;
            } else if (feedbackDateFilterType === 'Month') {
                const monthName = new Date(feedbackSelectedMonthYear, feedbackSelectedMonth - 1)
                    .toLocaleString('default', { month: 'long' });
                filterDescription = `${monthName} ${feedbackSelectedMonthYear}`;
            } else if (feedbackDateFilterType === 'Last 7 days') {
                const to = new Date();
                const from = new Date();
                from.setDate(to.getDate() - 7);
                filterDescription = `Last 7 days (${from.toLocaleDateString()} to ${to.toLocaleDateString()})`;
            } else if (feedbackDateFilterType === 'Custom range' && feedbackCustomFrom && feedbackCustomTo) {
                filterDescription = `${feedbackCustomFrom} to ${feedbackCustomTo}`;
            } else {
                filterDescription = 'All time';
            }

            const rows = [];
            const exportDate = new Date().toLocaleDateString();

            // Helper to escape CSV fields
            const escape = (text) => {
                if (text === null || text === undefined) return '';
                const str = String(text);
                return `"${str.replace(/"/g, '""')}"`;
            };

            // Helper to get local date in YYYY-MM-DD for filename
            const getLocalDateString = () => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // --- SECTION 1: REPORT HEADER ---
            rows.push(["LITPATH AI - FEEDBACK REPORT"]);
            rows.push(["Export Date", exportDate]);
            rows.push(["Filter Period", filterDescription]);
            rows.push(["Total Feedback Entries", filteredFeedbacks.length]);
            rows.push([]); // empty line

            // --- SECTION 2: COLUMN HEADERS ---
            rows.push(["Date", "Rating", "User Category", "Region", "Feedback Type", "Comment", "Status"]);

            // --- SECTION 3: DATA ROWS ---
            filteredFeedbacks.forEach(fb => {
                // Rating as words (e.g., "5 stars", "1 star")
                let ratingText = '';
                if (fb.litpath_rating) {
                    const num = fb.litpath_rating;
                    ratingText = `${num} star${num > 1 ? 's' : ''}`;
                }

                // Comment: use "N/A" if empty
                const comment = fb.message_comment && fb.message_comment.trim() !== ''
                    ? fb.message_comment
                    : 'N/A';


                rows.push([
                    escape(new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })),
                    escape(ratingText),
                    escape(getDisplayClientType(fb)),
                    escape(fb.region || ''),
                    fb.admin_category && fb.admin_category.trim() !== '' ? escape(fb.admin_category) : 'N/A',
                    escape(comment),
                    escape(fb.status || '')
                ]);
            });

            // Convert rows to CSV string
            const csvContent = rows.map(row => row.join(',')).join('\r\n');

            // Add BOM for UTF-8 (ensures special characters display correctly in Excel)
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `LitPathAI_FeedbackReport_${getLocalDateString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Feedback exported successfully!', 'success');

        } catch (error) {
            // --- EXCEPTION HANDLING E2: Export Generation Failure ---
            console.error("Feedback export failed:", error);
            showToast('Failed to generate export file. Please try again.', 'error');
        }
    };

    // ---------- Feedback Manager Export Data to PDF ----------
    const handleFeedbackExportPDF = async () => {
        try {
            const filteredFeedbacks = getFilteredFeedbacks();
            if (filteredFeedbacks.length === 0) {
                showToast('No data to export', 'error');
                return;
            }

            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF();
            let yPos = 20;
            const pageWidth = doc.internal.pageSize.width;

            // Determine filter description
            let filterDescription = '';
            if (feedbackDateFilterType === 'Year') {
                filterDescription = `Year ${feedbackSelectedYear}`;
            } else if (feedbackDateFilterType === 'Month') {
                const monthName = new Date(feedbackSelectedMonthYear, feedbackSelectedMonth - 1)
                    .toLocaleString('default', { month: 'long' });
                filterDescription = `${monthName} ${feedbackSelectedMonthYear}`;
            } else if (feedbackDateFilterType === 'Last 7 days') {
                const to = new Date();
                const from = new Date();
                from.setDate(to.getDate() - 7);
                filterDescription = `Last 7 days (${from.toLocaleDateString()} to ${to.toLocaleDateString()})`;
            } else if (feedbackDateFilterType === 'Custom range' && feedbackCustomFrom && feedbackCustomTo) {
                filterDescription = `${feedbackCustomFrom} to ${feedbackCustomTo}`;
            } else {
                filterDescription = 'All time';
            }

            showToast('Generating PDF report...', 'info');

            // Title
            doc.setFontSize(18);
            doc.text("LITPATH AI - FEEDBACK REPORT", pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;

            // Report header
            doc.setFontSize(12);
            doc.text(`Filter Period: ${filterDescription}`, 20, yPos);
            yPos += 6;
            doc.text(`Total Feedback Entries: ${filteredFeedbacks.length}`, 20, yPos);
            yPos += 6;
            doc.text(`Exported On: ${new Date().toLocaleString()}`, 20, yPos);
            yPos += 12;

            // Feedback List
            doc.setFontSize(14);
            doc.text("FEEDBACK ENTRIES", 20, yPos);
            yPos += 8;
            doc.setFontSize(10);

            filteredFeedbacks.forEach((fb, index) => {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                const ratingText = fb.litpath_rating ? `${fb.litpath_rating} star${fb.litpath_rating > 1 ? 's' : ''}` : 'N/A';
                const date = new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                doc.text(`Entry ${index + 1}:`, 20, yPos);
                yPos += 5;
                doc.text(`Date: ${date}`, 25, yPos);
                yPos += 5;
                doc.text(`Rating: ${ratingText}`, 25, yPos);
                yPos += 5;
                doc.text(`Category: ${getDisplayClientType(fb)}`, 25, yPos);
                yPos += 5;
                doc.text(`Region: ${fb.region || 'N/A'}`, 25, yPos);
                yPos += 5;
                doc.text(`Type: ${fb.admin_category && fb.admin_category.trim() !== '' ? fb.admin_category : 'N/A'}`, 25, yPos);
                yPos += 5;
                doc.text(`Status: ${fb.status || 'N/A'}`, 25, yPos);
                yPos += 5;

                const comment = fb.message_comment && fb.message_comment.trim() !== '' ? fb.message_comment : 'N/A';
                const commentLines = doc.splitTextToSize(`Comment: ${comment}`, 160);
                commentLines.forEach(line => {
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(line, 25, yPos);
                    yPos += 5;
                });

                yPos += 5;
            });

            // Save the PDF
            doc.save(`LitPathAI_FeedbackReport_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('Feedback exported to PDF successfully!', 'success');
        } catch (error) {
            console.error("Feedback PDF export failed:", error);
            showToast('Failed to generate PDF export. Please try again.', 'error');
        }
    };

    // ---------- Handle Feedback Row Click (Open Modal) ----------
    const handleFeedbackClick = (feedback) => {
        setSelectedFeedback(feedback);
        setIsEditingFeedback(false);
        setFeedbackEditForm({
            status: feedback.status || 'Pending',
            admin_category: feedback.admin_category || '',
            is_valid: feedback.is_valid,
            validity_remarks: feedback.validity_remarks || '',
            is_doable: feedback.is_doable,
            feasibility_remarks: feedback.feasibility_remarks || ''
        });
        setShowFeedbackHistory(false);
        setShowFeedbackModal(true);
    };

    // ---------- Handle Save Feedback from Modal ----------
    const handleSaveFeedbackFromModal = async () => {
        if (!feedbackEditForm.admin_category || feedbackEditForm.admin_category.trim() === '') {
            showToast('⚠️ Please select a Category.', 'error');
            return;
        }
        if (!feedbackEditForm.status || feedbackEditForm.status.trim() === '') {
            showToast('⚠️ Please select a Status.', 'error');
            return;
        }
        if (feedbackEditForm.is_valid === null) {
            showToast('⚠️ Please select Yes or No for Is this valid?.', 'error');
            return;
        }
        if (feedbackEditForm.is_doable === null) {
            showToast('⚠️ Please select Yes or No for Is it doable?.', 'error');
            return;
        }
        if (feedbackEditForm.is_valid !== null && (!feedbackEditForm.validity_remarks || feedbackEditForm.validity_remarks.trim() === '')) {
            showToast('⚠️ Please provide a reason why this is valid (or invalid).', 'error');
            return;
        }
        if (feedbackEditForm.is_doable !== null && (!feedbackEditForm.feasibility_remarks || feedbackEditForm.feasibility_remarks.trim() === '')) {
            showToast('⚠️ Please justify the feasibility.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/csm-feedback/${selectedFeedback.id}/`, {
                method: 'PATCH',
                headers: apiHeaders(true),
                body: JSON.stringify({
                    status: feedbackEditForm.status,
                    admin_category: feedbackEditForm.admin_category,
                    is_valid: feedbackEditForm.is_valid,
                    validity_remarks: feedbackEditForm.validity_remarks,
                    is_doable: feedbackEditForm.is_doable,
                    feasibility_remarks: feedbackEditForm.feasibility_remarks
                })
            });

            if (!response.ok) throw new Error('Failed to update');

            // Update the feedback in the local state
            const updatedFeedback = await response.json();
            setFeedbacks(feedbacks.map(fb => fb.id === updatedFeedback.id ? updatedFeedback : fb));
            setSelectedFeedback(updatedFeedback);
            setIsEditingFeedback(false);
            showToast('Feedback updated successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to update feedback.', 'error');
        }
    };

    const formatAuditValue = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return String(value);
    };


    // --- HELPER LOGIC FOR MATERIAL RATINGS TAB VISUALS ---
    const filteredRatings = materialRatings.filter(r => isRatingInDateRange(r.created_at));

    // Now functions that depend on filteredRatings
    const getRelevanceScore = () => {
        if (!filteredRatings.length) return 0;
        const positive = filteredRatings.filter(r => r.relevant === true).length;
        return ((positive / filteredRatings.length) * 100).toFixed(0);
    };

    const getRecentNegatives = () => {
        return materialRatings
            .filter(r => r.relevant === false)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 3);
    };

    const getTopMaterials = (ratingsArray) => {
        const counts = {};
        ratingsArray.forEach(r => {
            const title = r.material_title || r.document_file || r.document_name || r.title || r.thesis_title || 'Unknown';
            counts[title] = (counts[title] || 0) + 1;
        });
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([title, count]) => ({ title, count }));
    };

    const getDonutSectorPath = (startAngle, endAngle, outerRadius = 15.5, innerRadius = 8) => {
        const mapCssAngleToSvg = (cssAngle) => ((cssAngle + 270) % 360);
        const degToRad = (angle) => (Math.PI / 180) * angle;
        const startRad = degToRad(mapCssAngleToSvg(startAngle));
        const endRad = degToRad(mapCssAngleToSvg(endAngle));
        const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
        const outerStartX = 16 + outerRadius * Math.cos(startRad);
        const outerStartY = 16 + outerRadius * Math.sin(startRad);
        const outerEndX = 16 + outerRadius * Math.cos(endRad);
        const outerEndY = 16 + outerRadius * Math.sin(endRad);
        const innerStartX = 16 + innerRadius * Math.cos(endRad);
        const innerStartY = 16 + innerRadius * Math.sin(endRad);
        const innerEndX = 16 + innerRadius * Math.cos(startRad);
        const innerEndY = 16 + innerRadius * Math.sin(startRad);

        return `M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY} L ${innerStartX} ${innerStartY} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEndX} ${innerEndY} Z`;
    };

    const getVoteSourceName = (vote) => {
        return vote.material_title || vote.document_file || vote.document_name || vote.title || vote.thesis_title || 'Unknown material';
    };

    const getVoteMaterialTitle = (vote) => getVoteSourceName(vote);

    const getRelevanceDetailsByMaterial = () => {
        const grouped = {};
        filteredRatings.forEach((rating) => {
            const title = getVoteMaterialTitle(rating);
            if (!title) return;
            if (!grouped[title]) {
                grouped[title] = { title, helpful: 0, notRelevant: 0, total: 0 };
            }
            if (rating.relevant === true) grouped[title].helpful += 1;
            if (rating.relevant === false) grouped[title].notRelevant += 1;
            if (rating.relevant === true || rating.relevant === false) grouped[title].total += 1;
        });

        return Object.values(grouped)
            .filter(item => item.total > 0)
            .map(item => {
                const relevance = item.total > 0 ? (item.helpful / item.total) * 100 : 0;
                return {
                    ...item,
                    relevance: relevance,
                    relevanceRounded: Math.round(relevance),
                    needsReview: item.notRelevant > 0 || relevance < 70
                };
            })
            .sort((a, b) => a.relevance - b.relevance || a.title.localeCompare(b.title));
    };

    // Then counts that depend on filteredRatings
    const helpfulRatings = filteredRatings.filter(r => r.relevant === true);
    const notRelevantRatings = filteredRatings.filter(r => r.relevant === false);
    const helpfulCount = helpfulRatings.length;
    const helpfulMaterialsByTitle = getTopMaterials(helpfulRatings);
    const notRelevantMaterialsByTitle = getTopMaterials(notRelevantRatings);
    const notRelevantCount = notRelevantRatings.length;
    const totalVotes = helpfulCount + notRelevantCount;
    const helpfulPercent = totalVotes ? (helpfulCount / totalVotes) * 100 : 0;
    const helpfulAngle = helpfulPercent * 3.6;
    const relevanceDetails = getRelevanceDetailsByMaterial();
    const topRatedMaterials = getRelevanceDetailsByMaterial()
        .sort((a, b) => b.helpful - a.helpful || a.title.localeCompare(b.title));

    // Returns { start, end } as Date objects for the current filter
    const getCurrentDateRange = () => {
        const filterType = ratingsDateFilterType;

        if (filterType === 'Year') {
            const year = ratingsSelectedYear;
            return {
                start: new Date(year, 0, 1, 0, 0, 0, 0),
                end: new Date(year, 11, 31, 23, 59, 59, 999)
            };
        } else if (filterType === 'Month') {
            const year = ratingsSelectedMonthYear;
            const month = ratingsSelectedMonth - 1; // 0-based
            return {
                start: new Date(year, month, 1, 0, 0, 0, 0),
                end: new Date(year, month + 1, 0, 23, 59, 59, 999)
            };
        } else if (filterType === 'Last 7 days') {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        } else if (filterType === 'Custom range' && ratingsCustomFrom && ratingsCustomTo) {
            const fromParts = ratingsCustomFrom.split('-').map(Number);
            const toParts = ratingsCustomTo.split('-').map(Number);
            return {
                start: new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0),
                end: new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999)
            };
        } else {
            // 'All' – no specific range, return null to indicate whole dataset
            return null;
        }
    };

    // Helper function to get vote count for the previous period
    const getPreviousPeriodVotes = () => {
        const currentRange = getCurrentDateRange();
        if (!currentRange) return null; // 'All' filter – no previous period defined

        const { start, end } = currentRange;
        const duration = end - start; // milliseconds

        let prevStart, prevEnd;

        if (ratingsDateFilterType === 'Last 7 days') {
            // Previous 7 days: shift back by 7 days
            prevStart = new Date(start.getTime() - duration - 1);
            prevEnd = new Date(start.getTime() - 1);
        } else if (ratingsDateFilterType === 'Month') {
            // Previous month: shift back by one month
            const year = ratingsSelectedMonthYear;
            const month = ratingsSelectedMonth - 1;
            if (month === 0) {
                // January -> previous December of previous year
                prevStart = new Date(year - 1, 11, 1);
                prevEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
            } else {
                prevStart = new Date(year, month - 1, 1);
                prevEnd = new Date(year, month, 0, 23, 59, 59, 999);
            }
        } else if (ratingsDateFilterType === 'Year') {
            // Previous year
            const year = ratingsSelectedYear - 1;
            prevStart = new Date(year, 0, 1);
            prevEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        } else if (ratingsDateFilterType === 'Custom range') {
            // Shift the whole range back by its own duration
            prevStart = new Date(start.getTime() - duration - 1);
            prevEnd = new Date(start.getTime() - 1);
        } else {
            return null;
        }

        // Count votes in materialRatings that fall within the previous period
        return materialRatings.filter(r => {
            const d = new Date(r.created_at);
            return d >= prevStart && d <= prevEnd;
        }).length;
    };

    // Generate trend data for the Rating Trend chart (same with Citation Activity style)
    const getRatingTrendData = () => {
        if (!filteredRatings.length) return [];

        const filterType = ratingsDateFilterType;
        const today = new Date();
        let buckets = []; // will hold { start, end, label, tooltip, helpful, total }

        // Helper to create a bucket with proper day boundaries
        const createBucket = (startDate, endDate, label, tooltip) => ({
            start: new Date(startDate.setHours(0,0,0,0)),
            end: new Date(endDate.setHours(23,59,59,999)),
            label,
            tooltip,
            helpful: 0,
            total: 0
        });

        if (filterType === 'Year') {
            const year = ratingsSelectedYear;
            for (let m = 0; m < 12; m++) {
                const monthStart = new Date(year, m, 1);
                const monthEnd = new Date(year, m + 1, 0);
                const monthName = monthStart.toLocaleString('default', { month: 'short' }).toUpperCase();
                const tooltip = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
                buckets.push(createBucket(monthStart, monthEnd, monthName, tooltip));
            }
        } else if (filterType === 'Month') {
            const year = ratingsSelectedMonthYear;
            const month = ratingsSelectedMonth - 1; // 0‑based
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            let week = 1;
            for (let d = 1; d <= daysInMonth; d += 7) {
                const weekStart = new Date(year, month, d);
                const weekEnd = new Date(year, month, Math.min(d + 6, daysInMonth));
                const label = `W${week}`;
                const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const tooltip = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
                buckets.push(createBucket(weekStart, weekEnd, label, tooltip));
                week++;
            }
        } else if (filterType === 'Last 7 days') {
            // last 7 days including today
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dayStart = new Date(date.setHours(0,0,0,0));
                const dayEnd = new Date(date.setHours(23,59,59,999));
                const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                const tooltip = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                buckets.push(createBucket(dayStart, dayEnd, label, tooltip));
            }
        } else if (filterType === 'Custom range' && ratingsCustomFrom && ratingsCustomTo) {
            // Parse the custom range
            const fromParts = ratingsCustomFrom.split('-').map(Number);
            const toParts = ratingsCustomTo.split('-').map(Number);
            const fromDate = new Date(fromParts[0], fromParts[1]-1, fromParts[2]);
            const toDate = new Date(toParts[0], toParts[1]-1, toParts[2]);
            
            // Create daily buckets for every day in the range (inclusive)
            const diffTime = toDate - fromDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
            for (let i = 0; i < diffDays; i++) {
                const current = new Date(fromDate);
                current.setDate(fromDate.getDate() + i);
                const dayStart = new Date(current.setHours(0,0,0,0));
                const dayEnd = new Date(current.setHours(23,59,59,999));
                const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                const tooltip = current.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                buckets.push(createBucket(dayStart, dayEnd, label, tooltip));
            }

            // If the range is long, group days into intervals (like Citation Activity)
            if (diffDays > 15) {
                let intervalSize;
                if (diffDays > 30) intervalSize = 5;
                else if (diffDays > 15) intervalSize = 3;
                else intervalSize = 2;

                const grouped = [];
                for (let i = 0; i < buckets.length; i += intervalSize) {
                    const groupItems = buckets.slice(i, i + intervalSize);
                    const startBucket = groupItems[0];
                    const endBucket = groupItems[groupItems.length - 1];
                    const totalHelpful = groupItems.reduce((sum, b) => sum + b.helpful, 0);
                    const totalVotes = groupItems.reduce((sum, b) => sum + b.total, 0);
                    const startLabel = startBucket.label;
                    const endLabel = endBucket.label;
                    const rangeLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
                    grouped.push({
                        start: startBucket.start,
                        end: endBucket.end,
                        label: startLabel,        // display first date in group
                        tooltip: rangeLabel,
                        helpful: totalHelpful,
                        total: totalVotes
                    });
                }
                buckets = grouped;
            }
        } else {
            // 'All' filter – group by month first, then maybe group months into larger intervals
            if (filteredRatings.length === 0) return [];
            const dates = filteredRatings.map(r => new Date(r.created_at));
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            
            // Create monthly buckets from the first to the last month (inclusive)
            let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
            while (current <= endDate) {
                const year = current.getFullYear();
                const month = current.getMonth();
                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month + 1, 0);
                const monthName = monthStart.toLocaleString('default', { month: 'short' }).toUpperCase();
                const tooltip = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
                buckets.push(createBucket(monthStart, monthEnd, monthName, tooltip));
                current.setMonth(current.getMonth() + 1);
            }

            // If there are many months, group them into intervals to avoid overcrowding
            const totalMonths = buckets.length;
            const MAX_VISIBLE_POINTS = 18; // max number of x-axis labels we want
            if (totalMonths > MAX_VISIBLE_POINTS) {
                // Determine interval size: group months so that the number of groups ≤ MAX_VISIBLE_POINTS
                let intervalSize = Math.ceil(totalMonths / MAX_VISIBLE_POINTS);
                // But we also want intervals that make sense (e.g., 3 months = quarter, 6 months = half-year, 12 months = year)
                // Round intervalSize to nearest sensible value: 3, 6, or 12? Or just keep the calculated size.
                // For simplicity, we'll use the calculated size, but ensure it's at least 2.
                intervalSize = Math.max(2, intervalSize);
                
                const grouped = [];
                for (let i = 0; i < buckets.length; i += intervalSize) {
                    const groupItems = buckets.slice(i, i + intervalSize);
                    const startBucket = groupItems[0];
                    const endBucket = groupItems[groupItems.length - 1];
                    const totalHelpful = groupItems.reduce((sum, b) => sum + b.helpful, 0);
                    const totalVotes = groupItems.reduce((sum, b) => sum + b.total, 0);
                    
                    // Determine a label for the group: if interval spans multiple months, show range
                    const startMonth = startBucket.start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    const endMonth = endBucket.end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    const rangeLabel = startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`;
                    
                    // For display label, we might want a shorter version (e.g., "Q1 2023" or just the first month)
                    // Let's use the first month's abbreviated name + year if needed, but keep it compact.
                    // Alternatively, we could use quarter labels if intervalSize is 3.
                    // But to keep it simple, we'll use the first month's short label (e.g., "Jan 2023") and the full range in tooltip.
                    const firstMonthShort = startBucket.start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    
                    grouped.push({
                        start: startBucket.start,
                        end: endBucket.end,
                        label: firstMonthShort,   // displayed under the bar
                        tooltip: rangeLabel,      // full range in tooltip
                        helpful: totalHelpful,
                        total: totalVotes
                    });
                }
                buckets = grouped;
            }
        }

        // Fill buckets with actual ratings
        filteredRatings.forEach(r => {
            const ratingDate = new Date(r.created_at);
            const bucket = buckets.find(b => ratingDate >= b.start && ratingDate <= b.end);
            if (bucket) {
                if (r.relevant === true) bucket.helpful += 1;
                if (r.relevant !== null) bucket.total += 1;
            }
        });

        // Return the data in the format expected by the chart
        return buckets.map(b => ({
            start: b.start,
            end: b.end,
            displayLabel: b.label,
            tooltipRange: b.tooltip,
            avgScore: b.total > 0 ? (b.helpful / b.total) * 100 : 0,
            count: b.total,
            helpful: b.helpful
        }));
    };

    // Dynamic trend for Total Votes
    const currentVotes = filteredRatings.length;
    const previousVotes = getPreviousPeriodVotes();
    const voteTrend = previousVotes !== null ? currentVotes - previousVotes : null;
    const trendLabel = 
        ratingsDateFilterType === 'Last 7 days' ? 'last week' :
        ratingsDateFilterType === 'Month' ? 'previous month' :
        ratingsDateFilterType === 'Year' ? 'previous year' :
        ratingsDateFilterType === 'Custom range' ? 'previous period' : '';

    
    // ---------- Usage Analytics Export Data to CSV ----------
    const handleExportCSV = () => {
        try {
            // 1. Generate a descriptive subtitle for the export
            let filterText = '';
            if (overviewDateFilterType === 'Year') filterText = `Year ${overviewSelectedYear}`;
            else if (overviewDateFilterType === 'Month') filterText = `${new Date(0, overviewSelectedMonth - 1).toLocaleString('default', { month: 'long' })} ${overviewSelectedMonthYear}`;
            else if (overviewDateFilterType === 'Last 7 days') filterText = 'Last 7 days';
            else filterText = `${overviewCustomFrom} to ${overviewCustomTo}`;

            // Helper to get local date in YYYY-MM-DD for filename
            const getLocalDateString = () => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // 2. Helper to add rows safely
            let csvContent = "";
            const addRow = (rowArray) => {
                const formattedRow = rowArray.map(col => {
                    const cell = col === null || col === undefined ? "" : String(col);
                    return `"${cell.replace(/"/g, '""')}"`; // Escape quotes
                }).join(",");
                csvContent += formattedRow + "\r\n";
            };

            // 3. Build CSV Content
            addRow(["LITPATH AI - DASHBOARD REPORT"]);
            addRow([`Date Filter Applied: ${filterText}`]);
            addRow([`Exported On: ${new Date().toLocaleString()}`]);
            addRow([]);

            // --- KPIs ---
            addRow(["KEY PERFORMANCE INDICATORS"]);
            addRow(["Metric", "Value"]);
            addRow(["Total Theses", dashboardData.kpi.totalDocuments]);
            addRow(["Total Searches", dashboardData.kpi.totalSearches]);
            addRow(["Collection Utilisation (%)", dashboardData.kpi.utilizationPercent]);
            addRow(["Avg Response Time (ms)", dashboardData.kpi.avgResponseTime]);
            addRow(["Failed Queries", dashboardData.failedQueriesCount]);
            addRow([]);

            // --- TOP THESES ---
            addRow(["TOP THESES BROWSED"]);
            addRow(["Rank", "Title", "Author", "Year", "Degree", "Views", "Avg Rating"]);
            dashboardData.topTheses.forEach((t, i) => {
                addRow([i + 1, t.title, t.author, t.year, t.degree, t.view_count, t.avg_rating]);
            });
            addRow([]);

            // --- USAGE BY CATEGORY ---
            addRow(["USAGE BY CATEGORY"]);
            addRow(["Category", "User Count", "Percentage (%)"]);
            dashboardData.usageByCategory.forEach(c => {
                addRow([c.category, c.views, c.percentage]);
            });
            addRow([]);

            // --- GENDER DISTRIBUTION ---
            addRow(["GENDER DISTRIBUTION"]);
            addRow(["Gender", "User Count", "Percentage (%)"]);
            dashboardData.genderDistribution.forEach(g => {
                addRow([g.gender, g.count, g.percentage]);
            });
            addRow([]);

            // --- ACTIVITY TRENDS ---
            addRow(["ACTIVITY TRENDS (Views)"]);
            addRow(["Date Range", "Total Views"]);
            dashboardData.trends.forEach(t => {
                addRow([t.tooltipRange || t.label || t.month, t.views]);
            });
            addRow([]);

            // --- CITATION ACTIVITY ---
            addRow(["CITATION ACTIVITY"]);
            addRow(["Total Citations Copied", dashboardData.citationStats.total_copies]);
            addRow(["Date Range", "Copies"]);
            if (dashboardData.citationTrends && dashboardData.citationTrends.length > 0) {
                dashboardData.citationTrends.forEach(c => {
                    addRow([c.tooltipRange || c.label || c.month, c.copies]);
                });
            }

            // 4. Add BOM for UTF-8 and trigger download
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `LitPathAI_Report_${getLocalDateString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Report exported successfully!', 'success');

        } catch (error) {
            // --- EXCEPTION HANDLING E2: Export Generation Failure ---
            console.error("Overview export failed:", error);
            showToast('Failed to generate export file. Please try again.', 'error');
        }
    };

    // ---------- Usage Analytics Export Data to PDF ----------
    const handleExportPDF = async () => {
        try {
            showToast('Generating PDF report...', 'info');
            
            // Dynamically import required libraries
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const html2canvas = (await import('html2canvas')).default;
            
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            let yPos = 20;
            
            // Helper function to sanitize text and handle special characters
            const sanitizeText = (text) => {
                if (!text) return '';
                return String(text)
                    // Handle problematic Unicode characters that don't render well in courier font
                    .replace(/º/g, 'o') // Masculine ordinal indicator to 'o'
                    .replace(/ª/g, 'a') // Feminine ordinal indicator to 'a'
                    .replace(/°/g, 'o') // Degree symbol to 'o'
                    .replace(/²/g, '^2') // Superscript 2 to ^2
                    .replace(/³/g, '^3') // Superscript 3 to ^3
                    .replace(/¹/g, '^1') // Superscript 1 to ^1
                    .replace(/×/g, 'x') // Multiplication sign to 'x'
                    .replace(/÷/g, '/') // Division sign to /
                    .replace(/´/g, "'") // Acute accent to apostrophe
                    .replace(/`/g, "'") // Grave accent to apostrophe
                    .replace(/¨/g, '') // Diaeresis to empty
                    .replace(/¯/g, '-') // Macron to dash
                    .replace(/µ/g, 'u') // Micro sign to 'u'
                    .replace(/·/g, '.') // Middle dot to period
                    .replace(/•/g, '-') // Bullet to dash
                    .replace(/¢/g, 'c') // Cent sign
                    .replace(/£/g, '') // Pound sign
                    .replace(/¤/g, '') // Currency sign
                    .replace(/¥/g, '') // Yen sign
                    .replace(/§/g, '') // Section sign
                    .replace(/¶/g, '') // Pilcrow
                    // Handle dashes and quotes
                    .replace(/\u2212/g, '-') // Proper minus sign
                    .replace(/[\u2013\u2014]/g, '-') // En/Em dash to hyphen
                    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to apostrophe
                    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to regular quotes
                    // Remove any remaining non-ASCII characters that aren't handled
                    .replace(/[^\x20-\x7E]/g, ' ')
                    .replace(/\s+/g, ' ') // Normalize multiple spaces
                    .trim();
            };
            
            // Ensure PDF uses proper font configuration
            doc.setFont('courier', 'normal');
            
            // Helper function to calculate optimal table width and column distributions
            const calculateOptimalTableWidth = (proportionArray) => {
                const marginLeft = 10;
                const marginRight = 10;
                const availableWidth = pageWidth - marginLeft - marginRight; // ~190mm on A4
                const totalProportion = proportionArray.reduce((a, b) => a + b, 0);
                const columnWidths = proportionArray.map(p => (p / totalProportion) * availableWidth);
                return { columnWidths, margin: { left: marginLeft, right: marginRight } };
            };
            
            // Helper function to calculate centered margins for tables (legacy support)
            const getTableMargins = (columnWidths) => {
                const totalColumnWidth = columnWidths.reduce((a, b) => a + b, 0);
                const leftMargin = Math.max(10, (pageWidth - totalColumnWidth) / 2);
                return { left: leftMargin, right: 10 };
            };
            
            // Generate filter text for the report
            let filterText = '';
            if (overviewDateFilterType === 'Year') filterText = `Year ${overviewSelectedYear}`;
            else if (overviewDateFilterType === 'Month') filterText = `${new Date(0, overviewSelectedMonth - 1).toLocaleString('default', { month: 'long' })} ${overviewSelectedMonthYear}`;
            else if (overviewDateFilterType === 'Last 7 days') filterText = 'Last 7 days';
            else filterText = `${overviewCustomFrom} to ${overviewCustomTo}`;
            
            const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            // ============================================
            // HEADER — Title and Subtitle
            // ============================================
            doc.setFillColor(30, 116, 188); // #1E74BC
            doc.rect(0, 0, pageWidth, 25, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('courier', 'bold');
            doc.text(sanitizeText('Thesis & Dissertation Usage Report'), pageWidth / 2, 12, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setFont('courier', 'normal');
            doc.text(sanitizeText(`${filterText} | Exported: ${exportDate}`), pageWidth / 2, 20, { align: 'center' });
            
            yPos = 32;
            
            // ============================================
            // SECTION 1: SUMMARY STATS — Clean labeled table
            // ============================================
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Summary Statistics'), 14, yPos);
            yPos += 5;
            
            const summaryStatsData = [
                ['Total Theses', dashboardData.kpi.totalDocuments.toLocaleString()],
                ['Total Searches', dashboardData.kpi.totalSearches.toLocaleString()],
                ['Collection Utilisation', `${dashboardData.kpi.utilizationPercent}%`],
                ['Avg Response Time', `${dashboardData.kpi.avgResponseTime} ms`],
                ['Failed Queries', dashboardData.failedQueriesCount.toLocaleString()]
            ];
            
            const summaryStatsWidths = calculateOptimalTableWidth([2, 1]);
            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Value']],
                body: summaryStatsData,
                theme: 'striped',
                headStyles: { fillColor: [30, 116, 188], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: summaryStatsWidths.margin,
                columnStyles: {
                    0: { cellWidth: summaryStatsWidths.columnWidths[0], fontStyle: 'semibold' },
                    1: { cellWidth: summaryStatsWidths.columnWidths[1], fontStyle: 'bold', halign: 'right' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 2: TRENDING TOPICS — Numbered table
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Trending Topics'), 14, yPos);
            yPos += 5;
            
            const trendingTopicsData = dashboardData.trendingTopics.map((topic, i) => [
                `${i + 1}`,
                sanitizeText(topic.subject),
                topic.current_views.toLocaleString(),
                `${topic.growth >= 0 ? '+' : ''}${topic.growth}%`
            ]);
            
            const trendingTopicsWidths = calculateOptimalTableWidth([0.8, 3.5, 1.8, 1.2]);
            autoTable(doc, {
                startY: yPos,
                head: [['#', 'Topic', 'Views', 'Growth']],
                body: trendingTopicsData,
                theme: 'striped',
                headStyles: { fillColor: [30, 116, 188], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: trendingTopicsWidths.margin,
                columnStyles: {
                    0: { cellWidth: trendingTopicsWidths.columnWidths[0], halign: 'center' },
                    1: { cellWidth: trendingTopicsWidths.columnWidths[1], halign: 'left' },
                    2: { cellWidth: trendingTopicsWidths.columnWidths[2], halign: 'right', fontStyle: 'bold' },
                    3: { cellWidth: trendingTopicsWidths.columnWidths[3], halign: 'right' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 3: MOST VIEWED THESES — Table with rank, title, author, views
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Most Viewed Theses'), 14, yPos);
            yPos += 5;
            
            const topThesesData = dashboardData.topTheses.slice(0, 10).map((thesis, i) => [
                `${i + 1}`,
                sanitizeText(thesis.title || 'Unknown'),
                sanitizeText(thesis.author || 'Unknown'),
                thesis.view_count.toLocaleString()
            ]);
            
            const thesesWidths = calculateOptimalTableWidth([0.7, 3.2, 1.8, 1.3]);
            autoTable(doc, {
                startY: yPos,
                head: [['Rank', 'Title', 'Author', 'Views']],
                body: topThesesData,
                theme: 'striped',
                headStyles: { fillColor: [30, 116, 188], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: thesesWidths.margin,
                columnStyles: {
                    0: { cellWidth: thesesWidths.columnWidths[0], halign: 'center', fontStyle: 'bold' },
                    1: { cellWidth: thesesWidths.columnWidths[1], halign: 'left' },
                    2: { cellWidth: thesesWidths.columnWidths[2], halign: 'left' },
                    3: { cellWidth: thesesWidths.columnWidths[3], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 4: USERS BY CATEGORY — Chart image + table
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Users by Category'), 14, yPos);
            yPos += 5;
            
            
            // Users by Category table (2 columns: Category and Percentage)
            const categoryData = dashboardData.usageByCategory.map(cat => [
                sanitizeText(cat.category),
                `${cat.percentage}%`
            ]);
            
            const categoryWidths = calculateOptimalTableWidth([2.5, 1]);
            autoTable(doc, {
                startY: yPos,
                head: [['Category', 'Percentage']],
                body: categoryData,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: categoryWidths.margin,
                columnStyles: {
                    0: { cellWidth: categoryWidths.columnWidths[0], fontStyle: 'semibold', halign: 'left' },
                    1: { cellWidth: categoryWidths.columnWidths[1], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 5: GENDER DISTRIBUTION — Chart image + table
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Gender Distribution'), 14, yPos);
            yPos += 5;
            
            
            // Gender Distribution table
            const genderData = dashboardData.genderDistribution.map(gender => [
                sanitizeText(gender.gender),
                gender.count.toLocaleString(),
                `${gender.percentage}%`
            ]);
            
            const genderWidths = calculateOptimalTableWidth([2.2, 1.5, 1.3]);
            autoTable(doc, {
                startY: yPos,
                head: [['Gender', 'Count', 'Percentage']],
                body: genderData,
                theme: 'striped',
                headStyles: { fillColor: [168, 85, 247], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: genderWidths.margin,
                columnStyles: {
                    0: { cellWidth: genderWidths.columnWidths[0], fontStyle: 'semibold', halign: 'left' },
                    1: { cellWidth: genderWidths.columnWidths[1], halign: 'right' },
                    2: { cellWidth: genderWidths.columnWidths[2], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 6: TOP FAILED QUERIES — Table
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(239, 68, 68);
            doc.text('Top Failed Queries', 14, yPos);
            yPos += 5;
            
            const failedQueriesData = dashboardData.failedQueries.slice(0, 15).map(query => [
                sanitizeText(query.query || 'Unknown'),
                query.count.toLocaleString()
            ]);
            
            const queriesWidths = calculateOptimalTableWidth([3.5, 1]);
            autoTable(doc, {
                startY: yPos,
                head: [['Query', 'Count']],
                body: failedQueriesData,
                theme: 'striped',
                headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [254, 242, 242] },
                margin: queriesWidths.margin,
                columnStyles: {
                    0: { cellWidth: queriesWidths.columnWidths[0], halign: 'left' },
                    1: { cellWidth: queriesWidths.columnWidths[1], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });
            
            yPos = doc.lastAutoTable.finalY + 12;
            
            // ============================================
            // SECTION 7: ACTIVITY TRENDS & CITATION ACTIVITY — Charts stacked vertically
            // ============================================
            doc.addPage();
            yPos = 20;
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text('Activity Trends & Citation Activity', 14, yPos);
            yPos += 8;
            
            // Capture Activity Trends chart (full width, larger height)
            if (activityTrendsChartRef.current) {
                try {
                    const canvas = await html2canvas(activityTrendsChartRef.current, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = 180; // Full width (A4 page width - margins)
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    
                    // Ensure chart height is at least 80mm (~300px equivalent)
                    const minChartHeight = 80;
                    const finalImgHeight = Math.max(imgHeight, minChartHeight);
                    
                    // Check if we need a new page
                    if (yPos + finalImgHeight + 10 > pageHeight - 20) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.addImage(imgData, 'PNG', 14, yPos, imgWidth, finalImgHeight);
                    yPos += finalImgHeight + 15; // Add spacing between charts
                } catch (err) {
                    console.warn('Failed to capture Activity Trends chart:', err);
                }
            }
            
            // Capture Citation Activity chart (full width, larger height)
            if (citationActivityChartRef.current) {
                try {
                    const canvas = await html2canvas(citationActivityChartRef.current, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = 180; // Full width (A4 page width - margins)
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    
                    // Ensure chart height is at least 80mm (~300px equivalent)
                    const minChartHeight = 80;
                    const finalImgHeight = Math.max(imgHeight, minChartHeight);
                    
                    // Check if we need a new page
                    if (yPos + finalImgHeight + 10 > pageHeight - 20) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.addImage(imgData, 'PNG', 14, yPos, imgWidth, finalImgHeight);
                    yPos += finalImgHeight + 10;
                } catch (err) {
                    console.warn('Failed to capture Citation Activity chart:', err);
                }
            }
            
            // ============================================
            // FOOTER — Page numbers and timestamp
            // ============================================
            const pageCount = doc.internal.getNumberOfPages();
            const footerText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
            
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(156, 163, 175);
                doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.text(footerText, 14, pageHeight - 10);
            }
            
            // Save the PDF
            const filename = `LitPathAI_ThesisDissertation_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            showToast('Report exported to PDF successfully!', 'success');
        } catch (error) {
            console.error("Overview PDF export failed:", error);
            showToast('Failed to generate PDF export. Please try again.', 'error');
        }
    };


    // ---------- Material Ratings Export Data to CSV ----------
    const handleRatingsExportCSV = async () => {
        try {
            // 1. Basic check - ensure there's filtered data to export
            if (!filteredRatings || filteredRatings.length === 0) {
                showToast('No ratings data to export', 'error');
                return;
            }

            showToast('Generating report...', 'info');

            // 2. Determine the date range based on the current filter
            let fromDateStr = '', toDateStr = '', filterDescription = '';
            let dateFilterApplied = false;
            
            if (ratingsDateFilterType === 'Year') {
                dateFilterApplied = true;
                fromDateStr = `${ratingsSelectedYear}-01-01`;
                toDateStr = `${ratingsSelectedYear}-12-31`;
                filterDescription = `Year ${ratingsSelectedYear}`;
            } else if (ratingsDateFilterType === 'Month') {
                dateFilterApplied = true;
                const year = ratingsSelectedMonthYear;
                const month = String(ratingsSelectedMonth).padStart(2, '0');
                const daysInMonth = new Date(year, ratingsSelectedMonth, 0).getDate();
                fromDateStr = `${year}-${month}-01`;
                toDateStr = `${year}-${month}-${daysInMonth}`;
                const monthName = new Date(year, ratingsSelectedMonth - 1).toLocaleString('default', { month: 'long' });
                filterDescription = `${monthName} ${year}`;
            } else if (ratingsDateFilterType === 'Last 7 days') {
                dateFilterApplied = true;
                const to = new Date();
                const from = new Date();
                from.setDate(to.getDate() - 7);
                fromDateStr = from.toISOString().slice(0, 10);
                toDateStr = to.toISOString().slice(0, 10);
                filterDescription = `Last 7 days (${from.toLocaleDateString()} to ${to.toLocaleDateString()})`;
            } else if (ratingsDateFilterType === 'Custom range' && ratingsCustomFrom && ratingsCustomTo) {
                dateFilterApplied = true;
                fromDateStr = ratingsCustomFrom;
                toDateStr = ratingsCustomTo;
                filterDescription = `${fromDateStr} to ${toDateStr}`;
            } else {
                // 'All' – no specific range
                filterDescription = 'All time';
            }

            // 3. FETCH LEAST ACCESSED MATERIALS and apply the same date filter
            let allLeastAccessed = [];
            try {
                const response = await fetch(`${API_BASE_URL}/dashboard/least-browsed/?limit=1000`, {
                    headers: apiHeaders(true)
                });
                if (response.ok) {
                    allLeastAccessed = await response.json();
                    
                    // IMPORTANT: Filter least accessed materials by the same date range applied to ratings
                    if (dateFilterApplied && fromDateStr && toDateStr) {
                        const fromDate = new Date(fromDateStr);
                        const toDate = new Date(toDateStr);
                        toDate.setHours(23, 59, 59, 999);
                        
                        allLeastAccessed = allLeastAccessed.filter(m => {
                            if (!m.last_accessed) return false; // exclude materials with no access date
                            const lastAccessDate = new Date(m.last_accessed);
                            return lastAccessDate >= fromDate && lastAccessDate <= toDate;
                        });
                    }
                } else {
                    console.warn('Failed to fetch least accessed materials, status:', response.status);
                }
            } catch (error) {
                console.error('Error fetching least accessed materials:', error);
                alert(`Warning: Could not download the Dormant Materials list.\nReason: ${error.message}`);
            }

            // Helper to escape CSV fields
            const escape = (text) => {
                if (text === null || text === undefined) return '';
                const str = String(text);
                return `"${str.replace(/"/g, '""')}"`;
            };

            // Helper to get local date in YYYY-MM-DD for filename
            const getLocalDateString = () => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const rows = [];
            const exportDate = new Date().toLocaleDateString();

            // --- SECTION 1: REPORT HEADER ---
            rows.push(["LITPATH AI - DORMANT MATERIALS REPORT"]);
            rows.push(["Export Date", exportDate]);
            rows.push(["Filter Period", filterDescription]);
            
            // Filter to only dormant materials
            const dormantMaterials = allLeastAccessed ? allLeastAccessed.filter(m => m.is_dormant) : [];
            rows.push(["Total Dormant Materials (filtered)", dormantMaterials.length]);
            rows.push([]); // empty line

            // --- SECTION 2: DORMANT MATERIALS ONLY ---
            rows.push(["DORMANT MATERIALS"]);
            
            if (dormantMaterials && dormantMaterials.length > 0) {
                rows.push(["Material Title", "Year", "Uploaded", "Last Accessed", "Total Views"]);

                dormantMaterials.forEach(m => {
                    const uploaded = m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
                    const lastAccess = m.last_accessed ? new Date(m.last_accessed).toLocaleDateString() : 'Never';
                    const views = m.view_count || 0;

                    rows.push([
                        escape(m.title || m.file || 'Unknown'),
                        escape(m.year || '-'),
                        escape(uploaded),
                        escape(lastAccess),
                        views
                    ]);
                });
            } else {
                rows.push(["Note: No dormant materials found in the selected period."]);
            }

            // Convert rows to CSV string
            const csvContent = rows.map(row => row.join(',')).join('\r\n');

            // Add BOM for UTF-8
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `LitPathAI_DormantMaterials_${getLocalDateString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Dormant materials exported successfully!', 'success');

        } catch (error) {
            console.error("Export generation failed:", error);
            showToast('Failed to generate export file. Please try again.', 'error');
        }
    };

    const handleRatingsExportPDF = async () => {
        try {
            if (!filteredRatings || filteredRatings.length === 0) {
                showToast('No ratings data to export', 'error');
                return;
            }

            showToast('Generating PDF report...', 'info');

            // Dynamically import required libraries
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const html2canvas = (await import('html2canvas')).default;

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            let yPos = 20;

            // Helper function to sanitize text and handle special characters
            const sanitizeText = (text) => {
                if (!text) return '';
                return String(text)
                    // Handle problematic Unicode characters that don't render well in courier font
                    .replace(/º/g, 'o') // Masculine ordinal indicator to 'o'
                    .replace(/ª/g, 'a') // Feminine ordinal indicator to 'a'
                    .replace(/°/g, 'o') // Degree symbol to 'o'
                    .replace(/²/g, '^2') // Superscript 2 to ^2
                    .replace(/³/g, '^3') // Superscript 3 to ^3
                    .replace(/¹/g, '^1') // Superscript 1 to ^1
                    .replace(/×/g, 'x') // Multiplication sign to 'x'
                    .replace(/÷/g, '/') // Division sign to /
                    .replace(/´/g, "'") // Acute accent to apostrophe
                    .replace(/`/g, "'") // Grave accent to apostrophe
                    .replace(/¨/g, '') // Diaeresis to empty
                    .replace(/¯/g, '-') // Macron to dash
                    .replace(/µ/g, 'u') // Micro sign to 'u'
                    .replace(/·/g, '.') // Middle dot to period
                    .replace(/•/g, '-') // Bullet to dash
                    .replace(/¢/g, 'c') // Cent sign
                    .replace(/£/g, '') // Pound sign
                    .replace(/¤/g, '') // Currency sign
                    .replace(/¥/g, '') // Yen sign
                    .replace(/§/g, '') // Section sign
                    .replace(/¶/g, '') // Pilcrow
                    // Handle dashes and quotes
                    .replace(/\u2212/g, '-') // Proper minus sign
                    .replace(/[\u2013\u2014]/g, '-') // En/Em dash to hyphen
                    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to apostrophe
                    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to regular quotes
                    // Remove any remaining non-ASCII characters that aren't handled
                    .replace(/[^\x20-\x7E]/g, ' ')
                    .replace(/\s+/g, ' ') // Normalize multiple spaces
                    .trim();
            };

            // Ensure PDF uses proper font configuration
            doc.setFont('courier', 'normal');

            // Helper function to calculate optimal table width and column distributions
            const calculateOptimalTableWidth = (proportionArray) => {
                const marginLeft = 10;
                const marginRight = 10;
                const availableWidth = pageWidth - marginLeft - marginRight; // ~190mm on A4
                const totalProportion = proportionArray.reduce((a, b) => a + b, 0);
                const columnWidths = proportionArray.map(p => (p / totalProportion) * availableWidth);
                return { columnWidths, margin: { left: marginLeft, right: marginRight } };
            };

            // Helper function to calculate centered margins for tables (legacy support)
            const getTableMargins = (columnWidths) => {
                const totalColumnWidth = columnWidths.reduce((a, b) => a + b, 0);
                const leftMargin = Math.max(10, (pageWidth - totalColumnWidth) / 2);
                return { left: leftMargin, right: 10 };
            };

            // Determine the date range based on the current filter
            let filterText = '';
            let fromDateStr = '', toDateStr = '';
            let dateFilterApplied = false;

            if (ratingsDateFilterType === 'Year') {
                dateFilterApplied = true;
                filterText = `Year ${ratingsSelectedYear}`;
                fromDateStr = `${ratingsSelectedYear}-01-01`;
                toDateStr = `${ratingsSelectedYear}-12-31`;
            } else if (ratingsDateFilterType === 'Month') {
                dateFilterApplied = true;
                const monthName = new Date(ratingsSelectedMonthYear, ratingsSelectedMonth - 1).toLocaleString('default', { month: 'long' });
                filterText = `${monthName} ${ratingsSelectedMonthYear}`;
                const year = ratingsSelectedMonthYear;
                const month = String(ratingsSelectedMonth).padStart(2, '0');
                const daysInMonth = new Date(year, ratingsSelectedMonth, 0).getDate();
                fromDateStr = `${year}-${month}-01`;
                toDateStr = `${year}-${month}-${daysInMonth}`;
            } else if (ratingsDateFilterType === 'Last 7 days') {
                dateFilterApplied = true;
                const to = new Date();
                const from = new Date();
                from.setDate(to.getDate() - 7);
                filterText = `Last 7 days`;
                fromDateStr = from.toISOString().slice(0, 10);
                toDateStr = to.toISOString().slice(0, 10);
            } else if (ratingsDateFilterType === 'Custom range' && ratingsCustomFrom && ratingsCustomTo) {
                dateFilterApplied = true;
                filterText = `${ratingsCustomFrom} to ${ratingsCustomTo}`;
                fromDateStr = ratingsCustomFrom;
                toDateStr = ratingsCustomTo;
            } else {
                filterText = 'All Time';
            }

            const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            // ============================================
            // HEADER — Title and Subtitle
            // ============================================
            doc.setFillColor(30, 116, 188); // #1E74BC
            doc.rect(0, 0, pageWidth, 25, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('courier', 'bold');
            doc.text(sanitizeText('Content Quality & Material Ratings Report'), pageWidth / 2, 12, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont('courier', 'normal');
            doc.text(sanitizeText(`${filterText} | Exported: ${exportDate}`), pageWidth / 2, 20, { align: 'center' });

            yPos = 32;

            // ============================================
            // SECTION 1: SUMMARY STATISTICS — Clean labeled table
            // ============================================
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Summary Statistics'), 14, yPos);
            yPos += 5;

            const helpfulCount = filteredRatings.filter(r => r.relevant === true).length;
            const notRelevantCount = filteredRatings.filter(r => r.relevant === false).length;
            const relevanceScore = filteredRatings.length > 0 ? ((helpfulCount / filteredRatings.length) * 100).toFixed(1) : 0;

            const summaryStatsData = [
                ['Total Ratings', filteredRatings.length.toLocaleString()],
                ['Helpful', `${helpfulCount} (${relevanceScore}%)`],
                ['Not Relevant', `${notRelevantCount} (${(100 - relevanceScore).toFixed(1)}%)`],
                ['Relevance Score', `${relevanceScore}%`],
                ['Dormant Materials', dormantCount.toLocaleString()]
            ];

            autoTable(doc, {
                startY: yPos,
                head: [['Metric', 'Value']],
                body: summaryStatsData,
                theme: 'striped',
                headStyles: { fillColor: [30, 116, 188], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: calculateOptimalTableWidth([2, 1]).margin,
                columnStyles: {
                    0: { cellWidth: calculateOptimalTableWidth([2, 1]).columnWidths[0], fontStyle: 'semibold' },
                    1: { cellWidth: calculateOptimalTableWidth([2, 1]).columnWidths[1], fontStyle: 'bold', halign: 'right' }
                },
                columnWidth: 'wrap'
            });

            yPos = doc.lastAutoTable.finalY + 12;

            // ============================================
            // SECTION 2: RATING DISTRIBUTION CHART
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Rating Distribution'), 14, yPos);
            yPos += 5;

            // Rating Distribution breakdown table
            const ratingDistData = [
                ['Helpful', `${helpfulCount}`, `${relevanceScore}%`],
                ['Not Relevant', `${notRelevantCount}`, `${(100 - relevanceScore).toFixed(1)}%`]
            ];

            const ratingDistWidths = calculateOptimalTableWidth([2.2, 1.4, 1.4]);
            autoTable(doc, {
                startY: yPos,
                head: [['Rating Type', 'Count', 'Percentage']],
                body: ratingDistData,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: ratingDistWidths.margin,
                columnStyles: {
                    0: { cellWidth: ratingDistWidths.columnWidths[0], fontStyle: 'semibold', halign: 'left' },
                    1: { cellWidth: ratingDistWidths.columnWidths[1], halign: 'right' },
                    2: { cellWidth: ratingDistWidths.columnWidths[2], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });

            yPos = doc.lastAutoTable.finalY + 12;

            // ============================================
            // SECTION 3: RATING TREND CHART
            // ============================================
            if (doc.lastAutoTable.finalY > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Rating Trend Over Time'), 14, yPos);
            yPos += 5;

            // Capture Rating Trend chart
            if (ratingTrendChartRef.current) {
                try {
                    const canvas = await html2canvas(ratingTrendChartRef.current, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = 170;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    if (yPos + imgHeight + 10 > pageHeight - 10) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.addImage(imgData, 'PNG', 14, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 8;
                } catch (err) {
                    console.warn('Failed to capture Rating Trend chart:', err);
                }
            }

            // ============================================
            // SECTION 4: TOP RATED MATERIALS — Table
            // ============================================
            if (yPos > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Top Rated Materials'), 14, yPos);
            yPos += 5;

            const topMaterials = getTopMaterials(filteredRatings).slice(0, 10);
            const topMaterialsData = topMaterials.map((item, i) => [
                `${i + 1}`,
                sanitizeText(item.title || 'Unknown'),
                item.count.toLocaleString()
            ]);

            const topMaterialsWidths = calculateOptimalTableWidth([0.7, 3.5, 1.3]);
            autoTable(doc, {
                startY: yPos,
                head: [['Rank', 'Material Title', 'Helpful Votes']],
                body: topMaterialsData,
                theme: 'striped',
                headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: topMaterialsWidths.margin,
                columnStyles: {
                    0: { cellWidth: topMaterialsWidths.columnWidths[0], halign: 'center', fontStyle: 'bold' },
                    1: { cellWidth: topMaterialsWidths.columnWidths[1], halign: 'left' },
                    2: { cellWidth: topMaterialsWidths.columnWidths[2], halign: 'right', fontStyle: 'bold' }
                },
                columnWidth: 'wrap'
            });

            yPos = doc.lastAutoTable.finalY + 12;

            // ============================================
            // SECTION 5: DETAILED RATINGS LOG — Table
            // ============================================
            if (yPos > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Detailed Ratings Log'), 14, yPos);
            yPos += 5;

            const ratingsLogData = filteredRatings.slice(0, 75).map((r) => [
                new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
                sanitizeText(r.material_title || r.document_file || 'Unknown'),
                r.relevant === true ? 'Helpful' : 'Not Relevant',
                sanitizeText(r.message_comment && r.message_comment.trim() ? r.message_comment : '—')
            ]);

            const logWidths = calculateOptimalTableWidth([0.9, 2.8, 1.2, 1.6]);
            autoTable(doc, {
                startY: yPos,
                head: [['Date', 'Material', 'Rating', 'Comment']],
                body: ratingsLogData,
                theme: 'striped',
                headStyles: { fillColor: [168, 85, 247], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 3 },
                bodyStyles: { fontSize: 8, cellPadding: 2, valign: 'top' },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                margin: logWidths.margin,
                columnStyles: {
                    0: { cellWidth: logWidths.columnWidths[0], halign: 'center' },
                    1: { cellWidth: logWidths.columnWidths[1], halign: 'left' },
                    2: { cellWidth: logWidths.columnWidths[2], halign: 'center', fontStyle: 'semibold' },
                    3: { cellWidth: logWidths.columnWidths[3], halign: 'left' }
                },
                columnWidth: 'wrap'
            });

            yPos = doc.lastAutoTable.finalY + 12;

            // ============================================
            // SECTION 6: LEAST ACCESSED MATERIALS (if any)
            // ============================================
            if (leastAccessedMaterials && leastAccessedMaterials.length > 0) {
                if (yPos > pageHeight - 60) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(14);
                doc.setFont('courier', 'bold');
                doc.setTextColor(239, 68, 68);
                doc.text(sanitizeText('Least Viewed Materials'), 14, yPos);
                yPos += 5;

                const leastAccessedData = leastAccessedMaterials.slice(0, 15).map((m) => [
                    sanitizeText(m.title || 'Unknown'),
                    m.view_count || 0,
                    m.last_accessed ? new Date(m.last_accessed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Never',
                    m.is_dormant ? 'Dormant' : m.view_count === 0 ? '0 Views' : m.view_count < 20 ? 'Low' : 'Moderate'
                ]);

                const leastAccessedWidths = calculateOptimalTableWidth([2.5, 0.8, 1.2, 1.5]);
                autoTable(doc, {
                    startY: yPos,
                    head: [['Material', 'Views', 'Last Accessed', 'Status']],
                    body: leastAccessedData,
                    theme: 'striped',
                    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 4 },
                    bodyStyles: { fontSize: 9, cellPadding: 3, valign: 'top' },
                    alternateRowStyles: { fillColor: [245, 248, 250] },
                    margin: leastAccessedWidths.margin,
                    columnStyles: {
                        0: { cellWidth: leastAccessedWidths.columnWidths[0], halign: 'left' },
                        1: { cellWidth: leastAccessedWidths.columnWidths[1], halign: 'right' },
                        2: { cellWidth: leastAccessedWidths.columnWidths[2], halign: 'center' },
                        3: { cellWidth: leastAccessedWidths.columnWidths[3], halign: 'center', fontStyle: 'semibold' }
                    },
                    columnWidth: 'wrap'
                });
            }

            // Save the PDF
            doc.save(`LitPathAI_MaterialRatings_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('Material Ratings exported to PDF successfully!', 'success');
        } catch (error) {
            console.error("Ratings PDF export failed:", error);
            showToast('Failed to generate PDF export. Please try again.', 'error');
        }
    };

    // ---------- Dormant Materials Modal Functions ----------
    const handleOpenDormantMaterialsModal = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/least-browsed/?limit=1000`, {
                headers: apiHeaders(true)
            });
            if (res.ok) {
                const data = await res.json();
                const dormantMaterials = data.filter(m => m.is_dormant);
                setDormantMaterialsList(dormantMaterials);
                setShowDormantMaterialsModal(true);
            }
        } catch (error) {
            console.error("Failed to fetch dormant materials", error);
            showToast('Failed to load dormant materials', 'error');
        }
    };

    const handleOpenVotesModal = () => {
        setShowVotesModal(true);
    };

    const handleOpenHelpfulModal = () => {
        setShowHelpfulModal(true);
    };

    const handleOpenNotRelevantModal = () => {
        setShowNotRelevantModal(true);
    };

    const handleOpenRelevanceScoreModal = () => {
        setShowRelevanceScoreModal(true);
    };

    const handleOpenTopRatedModal = () => {
        setShowTopRatedModal(true);
    };

    const handleOpenTopicMaterialsModal = async (topicItem) => {
        // topicItem: { subject, current_views, prev_views, growth }
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        try {
            const limit = Math.max(dashboardData.kpi?.totalDocuments || 500, 500);
            const res = await fetch(`${API_BASE_URL}/dashboard/top-theses/?from=${from}&to=${to}&limit=${limit}`, {
                headers: apiHeaders(true)
            });
            if (!res.ok) {
                console.error('Failed to fetch materials for topic modal');
                showToast('Failed to load materials for this topic', 'error');
                return;
            }
            const data = await res.json();
            const mats = (data.materials || []).filter(m => {
                if (!m.subjects || !Array.isArray(m.subjects)) return false;
                return m.subjects.map(s => (s || '').toLowerCase().trim()).includes((topicItem.subject || '').toLowerCase().trim());
            });
            mats.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
            setSelectedTopicName(topicItem.subject || 'Topic');
            setSelectedTopicViewCount(topicItem.current_views || 0);
            setTopicMaterials(mats);
            setShowTopicMaterialsModal(true);
        } catch (err) {
            console.error('Error fetching topic materials', err);
            showToast('Failed to load materials for this topic', 'error');
        }
    };

    const handleCloseTopicMaterialsModal = () => {
        setShowTopicMaterialsModal(false);
        setSelectedTopicName('');
        setTopicMaterials([]);
        setSelectedTopicViewCount(0);
    };

    const handleOpenAllThesesModal = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        setAllThesesLoading(true);
        setShowAllThesesModal(true);
        try {
            const limit = Math.max(dashboardData.kpi?.totalDocuments || 500, 500);
            const res = await fetch(`${API_BASE_URL}/dashboard/top-theses/?from=${from}&to=${to}&limit=${limit}`, {
                headers: apiHeaders(true)
            });
            if (!res.ok) {
                console.error('Failed to fetch full theses list');
                showToast('Failed to load full theses list', 'error');
                return;
            }
            const data = await res.json();
            setAllTheses(data.materials || []);
        } catch (err) {
            console.error('Error fetching all theses', err);
            showToast('Failed to load full theses list', 'error');
        } finally {
            setAllThesesLoading(false);
        }
    };

    const handleCloseAllThesesModal = () => {
        setShowAllThesesModal(false);
        setAllTheses([]);
    };

    const handleOpenGenderDetailModal = (genderItem) => {
        setSelectedGenderItem(genderItem);
        setShowGenderDetailModal(true);
    };

    const handleCloseGenderDetailModal = () => {
        setShowGenderDetailModal(false);
        setSelectedGenderItem(null);
    };

    const handleOpenAllFailedQueriesModal = async () => {
        const { from, to } = getDateRange();
        if (overviewDateFilterType === 'Custom range' && (!from || !to)) return;
        setAllFailedQueriesLoading(true);
        setShowAllFailedQueriesModal(true);
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/failed-queries-details/?from=${from}&to=${to}&limit=500`, {
                headers: apiHeaders(true)
            });
            if (!res.ok) {
                console.error('Failed to fetch full failed queries list');
                showToast('Failed to load full failed queries list', 'error');
                return;
            }
            const data = await res.json();
            setAllFailedQueries(data.failed_queries || []);
        } catch (err) {
            console.error('Error fetching all failed queries', err);
            showToast('Failed to load full failed queries list', 'error');
        } finally {
            setAllFailedQueriesLoading(false);
        }
    };

    const handleCloseAllFailedQueriesModal = () => {
        setShowAllFailedQueriesModal(false);
        setAllFailedQueries([]);
    };

    const handleOpenActivityTrendDetailModal = async (item) => {
        const { from, to } = getTrendBarDateRange(item);
        console.log('Activity trend bucket item:', item);
        console.log('Computed from/to:', from, to);
        if (!from || !to) {
            showToast('Date details unavailable for this period', 'error');
            return;
        }
        setSelectedActivityBucket(item);
        setActivityBucketLoading(true);
        setShowActivityTrendDetailModal(true);
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/top-theses/?from=${from}&to=${to}&limit=500`, {
                headers: apiHeaders(true)
            });
            if (!res.ok) {
                console.error('Failed to fetch materials for this period');
                showToast('Failed to load materials for this period', 'error');
                return;
            }
            const data = await res.json();
            const mats = (data.materials || []).sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
            setActivityBucketMaterials(mats);
        } catch (err) {
            console.error('Error fetching activity bucket materials', err);
            showToast('Failed to load materials for this period', 'error');
        } finally {
            setActivityBucketLoading(false);
        }
    };

    const handleCloseActivityTrendDetailModal = () => {
        setShowActivityTrendDetailModal(false);
        setSelectedActivityBucket(null);
        setActivityBucketMaterials([]);
    };

    const handleOpenCitationDetailModal = async (item) => {
        const { from, to } = getCitationPointDateRange(item);
        if (!from || !to) {
            showToast('Date details unavailable for this period', 'error');
            return;
        }
        setSelectedCitationBucket(item);
        setCitationBucketLoading(true);
        setShowCitationDetailModal(true);
        try {
            const res = await fetch(`${API_BASE_URL}/dashboard/citation-stats/?from=${from}&to=${to}`, {
                headers: apiHeaders(true)
            });
            if (!res.ok) {
                console.error('Failed to fetch citation details');
                showToast('Failed to load citation details for this period', 'error');
                return;
            }
            const data = await res.json();
            setCitationBucketMaterials(data.top_cited || []);
        } catch (err) {
            console.error('Error fetching citation details', err);
            showToast('Failed to load citation details for this period', 'error');
        } finally {
            setCitationBucketLoading(false);
        }
    };

    const handleCloseCitationDetailModal = () => {
        setShowCitationDetailModal(false);
        setSelectedCitationBucket(null);
        setCitationBucketMaterials([]);
    };

    const handleRequestArchive = (material) => {
        setArchiveTargetMaterial(material);
        setShowArchiveConfirmModal(true);
    };

    const handleConfirmArchivePlaceholder = () => {
        // UI-only placeholder: actual backend archive endpoint not implemented
        setShowArchiveConfirmModal(false);
        setArchiveTargetMaterial(null);
        showToast('Archive feature coming soon', 'info');
    };

    const handleCancelArchive = () => {
        setShowArchiveConfirmModal(false);
        setArchiveTargetMaterial(null);
    };

    const formatVoteDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const getVoteTypeLabel = (vote) => {
        if (vote.relevant === true) return 'Helpful';
        if (vote.relevant === false) return 'Not Relevant';
        return 'Unknown';
    };

    const getVoteComment = (vote) => {
        return vote.message_comment || vote.comment || vote.note || vote.notes || '—';
    };

    const getTrendBucketVotes = (bucket) => {
        if (!bucket) return [];
        return filteredRatings
            .filter(r => {
                const d = new Date(r.created_at);
                return d >= bucket.start && d <= bucket.end;
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    const handleOpenTrendDetailModal = (bucket) => {
        setSelectedTrendBucket(bucket);
        setShowRatingTrendDetailModal(true);
    };

    const handleCloseTrendDetailModal = () => {
        setShowRatingTrendDetailModal(false);
        setSelectedTrendBucket(null);
    };

    const formatDormantDate = (value, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
        if (!value) return 'Never';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Never';
        return date.toLocaleDateString('en-US', options);
    };

    const getDormantInactivityDays = (material) => {
        const anchorDate = material.last_accessed || material.created_at;
        if (!anchorDate) return 0;
        const date = new Date(anchorDate);
        if (Number.isNaN(date.getTime())) return 0;
        return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
    };

    const getDormantReason = (material) => {
        if (!material.last_accessed) return 'Never accessed';
        return 'Inactive for 30+ days';
    };

    const getDormantAction = (material) => {
        if (!material.last_accessed) return 'Prioritize discovery campaign';
        if ((material.view_count || 0) === 0) return 'Review metadata and promote';
        return 'Refresh title visibility or recommendations';
    };

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDormantKpis = () => {
        const total = dormantMaterialsList.length;
        const neverAccessed = dormantMaterialsList.filter(material => !material.last_accessed).length;
        const previouslyAccessed = total - neverAccessed;
        const zeroViews = dormantMaterialsList.filter(material => (material.view_count || 0) === 0).length;
        const totalViews = dormantMaterialsList.reduce((sum, material) => sum + (material.view_count || 0), 0);
        const inactivityDays = dormantMaterialsList.map(getDormantInactivityDays);
        const longestInactiveDays = inactivityDays.length ? Math.max(...inactivityDays) : 0;
        const averageInactiveDays = inactivityDays.length
            ? Math.round(inactivityDays.reduce((sum, days) => sum + days, 0) / inactivityDays.length)
            : 0;

        return {
            total,
            neverAccessed,
            previouslyAccessed,
            zeroViews,
            totalViews,
            averageViews: total ? (totalViews / total).toFixed(1) : '0.0',
            averageInactiveDays,
            longestInactiveDays,
            neverAccessedPercent: total ? Math.round((neverAccessed / total) * 100) : 0,
            zeroViewsPercent: total ? Math.round((zeroViews / total) * 100) : 0
        };
    };

    const getDormantExportRows = () => dormantMaterialsList.map(material => ({
        title: material.title || 'Untitled',
        year: material.year || '-',
        file: material.file || '-',
        uploaded: material.created_at ? formatDormantDate(material.created_at) : '-',
        lastAccessed: material.last_accessed ? formatDormantDate(material.last_accessed) : 'Never',
        daysInactive: getDormantInactivityDays(material),
        views: material.view_count || 0,
        reason: getDormantReason(material),
        action: getDormantAction(material)
    }));

    const handleDormantMaterialsExportExcel = () => {
        try {
            if (dormantMaterialsList.length === 0) {
                showToast('No dormant materials to export', 'error');
                return;
            }

            const escapeHtml = (value) => {
                if (value === null || value === undefined) return '';
                return String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            };

            const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const kpis = getDormantKpis();
            const rows = getDormantExportRows();
            const summaryRows = [
                ['Total Dormant Materials', kpis.total],
                ['Never Accessed', `${kpis.neverAccessed} (${kpis.neverAccessedPercent}%)`],
                ['Previously Accessed', kpis.previouslyAccessed],
                ['Zero View Materials', `${kpis.zeroViews} (${kpis.zeroViewsPercent}%)`],
                ['Average Views', kpis.averageViews],
                ['Average Inactive Days', kpis.averageInactiveDays],
                ['Longest Inactive Days', kpis.longestInactiveDays]
            ];

            const workbookHtml = `
                <html>
                    <head>
                        <meta charset="UTF-8" />
                        <style>
                            body { font-family: Arial, sans-serif; color: #111827; }
                            h1 { color: #1E74BC; margin-bottom: 4px; }
                            .meta { color: #4b5563; margin-bottom: 18px; }
                            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                            th { background: #1E74BC; color: #ffffff; font-weight: 700; }
                            th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
                            .summary th { background: #155a8f; }
                            .risk { background: #fef2f2; color: #991b1b; font-weight: 700; }
                        </style>
                    </head>
                    <body>
                        <h1>LitPath AI - Dormant Materials KPI Report</h1>
                        <div class="meta">Exported: ${escapeHtml(exportDate)} | Definition: materials never accessed or inactive for 30+ days after upload.</div>
                        <table class="summary">
                            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                            <tbody>
                                ${summaryRows.map(row => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td></tr>`).join('')}
                            </tbody>
                        </table>
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Year</th>
                                    <th>File</th>
                                    <th>Uploaded</th>
                                    <th>Last Accessed</th>
                                    <th>Days Inactive</th>
                                    <th>Views</th>
                                    <th>Dormancy Reason</th>
                                    <th>Recommended Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(row => `
                                    <tr>
                                        <td>${escapeHtml(row.title)}</td>
                                        <td>${escapeHtml(row.year)}</td>
                                        <td>${escapeHtml(row.file)}</td>
                                        <td>${escapeHtml(row.uploaded)}</td>
                                        <td>${escapeHtml(row.lastAccessed)}</td>
                                        <td class="${row.daysInactive >= 90 ? 'risk' : ''}">${escapeHtml(row.daysInactive)}</td>
                                        <td>${escapeHtml(row.views)}</td>
                                        <td>${escapeHtml(row.reason)}</td>
                                        <td>${escapeHtml(row.action)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </body>
                </html>
            `;

            const blob = new Blob(['\uFEFF' + workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `LitPathAI_DormantMaterials_KPI_${getLocalDateString()}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Dormant materials exported to Excel successfully!', 'success');
        } catch (error) {
            console.error("Dormant materials Excel export failed:", error);
            showToast('Failed to export dormant materials. Please try again.', 'error');
        }
    };

    // eslint-disable-next-line no-unused-vars
    const handleDormantMaterialsExportCSV = () => {
        try {
            if (dormantMaterialsList.length === 0) {
                showToast('No dormant materials to export', 'error');
                return;
            }

            const rows = [];
            const exportDate = new Date().toLocaleDateString();

            const escape = (text) => {
                if (text === null || text === undefined) return '';
                const str = String(text);
                return `"${str.replace(/"/g, '""')}"`;
            };

            const getLocalDateString = () => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Header section
            rows.push(["LITPATH AI - DORMANT MATERIALS REPORT"]);
            rows.push(["Export Date", exportDate]);
            rows.push(["Total Dormant Materials", dormantMaterialsList.length]);
            rows.push([]);

            // Column headers
            rows.push(["Title", "Uploaded Date", "Last Accessed", "Views", "Status"]);

            // Data rows
            dormantMaterialsList.forEach(material => {
                const uploadedDate = material.created_at 
                    ? new Date(material.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—';
                const lastAccessed = material.last_accessed 
                    ? new Date(material.last_accessed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'Never';

                rows.push([
                    escape(material.title || ''),
                    escape(uploadedDate),
                    escape(lastAccessed),
                    escape(material.view_count || 0),
                    'Dormant'
                ]);
            });

            const csvContent = rows.map(row => row.join(',')).join('\r\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `LitPathAI_DormantMaterials_${getLocalDateString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Dormant materials exported to CSV successfully!', 'success');
        } catch (error) {
            console.error("Dormant materials CSV export failed:", error);
            showToast('Failed to export dormant materials. Please try again.', 'error');
        }
    };

    const handleDormantMaterialsExportPDF = async () => {
        try {
            if (dormantMaterialsList.length === 0) {
                showToast('No dormant materials to export', 'error');
                return;
            }

            const { jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            let yPos = 20;
            
            // Helper function to sanitize text and handle special characters
            const sanitizeText = (text) => {
                if (!text) return '';
                return String(text)
                    // Handle problematic Unicode characters that don't render well in courier font
                    .replace(/º/g, 'o') // Masculine ordinal indicator to 'o'
                    .replace(/ª/g, 'a') // Feminine ordinal indicator to 'a'
                    .replace(/°/g, 'o') // Degree symbol to 'o'
                    .replace(/²/g, '^2') // Superscript 2 to ^2
                    .replace(/³/g, '^3') // Superscript 3 to ^3
                    .replace(/¹/g, '^1') // Superscript 1 to ^1
                    .replace(/×/g, 'x') // Multiplication sign to 'x'
                    .replace(/÷/g, '/') // Division sign to /
                    .replace(/´/g, "'") // Acute accent to apostrophe
                    .replace(/`/g, "'") // Grave accent to apostrophe
                    .replace(/¨/g, '') // Diaeresis to empty
                    .replace(/¯/g, '-') // Macron to dash
                    .replace(/µ/g, 'u') // Micro sign to 'u'
                    .replace(/·/g, '.') // Middle dot to period
                    .replace(/•/g, '-') // Bullet to dash
                    .replace(/¢/g, 'c') // Cent sign
                    .replace(/£/g, '') // Pound sign
                    .replace(/¤/g, '') // Currency sign
                    .replace(/¥/g, '') // Yen sign
                    .replace(/§/g, '') // Section sign
                    .replace(/¶/g, '') // Pilcrow
                    .replace(/¹/g, '1') // Superscript 1
                    // Handle dashes and quotes
                    .replace(/\u2212/g, '-') // Proper minus sign
                    .replace(/[\u2013\u2014]/g, '-') // En/Em dash to hyphen
                    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to apostrophe
                    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to regular quotes
                    // Remove any remaining non-ASCII characters that aren't handled
                    .replace(/[^\x20-\x7E]/g, ' ')
                    .replace(/\s+/g, ' ') // Normalize multiple spaces
                    .trim();
            };
            
            // Set default font for better Unicode support
            doc.setFont('courier', 'normal');

            // Header
            doc.setFillColor(30, 116, 188);
            doc.rect(0, 0, pageWidth, 25, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('courier', 'bold');
            doc.text(sanitizeText('Dormant Materials Report'), pageWidth / 2, 12, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont('courier', 'normal');
            const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            doc.text(sanitizeText(`Exported: ${exportDate} | Total: ${dormantMaterialsList.length}`), pageWidth / 2, 20, { align: 'center' });

            yPos = 32;
            const kpis = getDormantKpis();
            const exportRows = getDormantExportRows();

            // Summary
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('KPI Summary'), 14, yPos);
            yPos += 5;

            doc.setFontSize(10);
            doc.setFont('courier', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(sanitizeText(`Total Dormant Materials: ${dormantMaterialsList.length}`), 14, yPos);
            yPos += 5;
            doc.text(sanitizeText(`Definition: Materials not accessed for 30+ days or never accessed (uploaded 30+ days ago)`), 14, yPos);
            yPos += 8;

            autoTable(doc, {
                head: [['Metric', 'Value']],
                body: [
                    ['Never Accessed', `${kpis.neverAccessed} (${kpis.neverAccessedPercent}%)`],
                    ['Previously Accessed', kpis.previouslyAccessed.toLocaleString()],
                    ['Zero View Materials', `${kpis.zeroViews} (${kpis.zeroViewsPercent}%)`],
                    ['Average Views', kpis.averageViews],
                    ['Average Inactive Days', `${kpis.averageInactiveDays} days`],
                    ['Longest Inactive Days', `${kpis.longestInactiveDays} days`]
                ],
                startY: yPos,
                margin: 14,
                theme: 'striped',
                headStyles: { fillColor: [30, 116, 188], textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 100, fontStyle: 'bold' },
                    1: { cellWidth: 80, halign: 'right' }
                }
            });

            yPos = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(14);
            doc.setFont('courier', 'bold');
            doc.setTextColor(30, 116, 188);
            doc.text(sanitizeText('Dormant Thesis Details'), 14, yPos);
            yPos += 5;

            // Table data - sanitize all titles to handle special characters
            const detailedDormantRows = exportRows.map(row => [
                sanitizeText(row.title),
                sanitizeText(row.year),
                sanitizeText(row.lastAccessed),
                row.daysInactive.toString(),
                row.views.toString(),
                sanitizeText(row.reason),
                sanitizeText(row.action)
            ]);

            const tableData = dormantMaterialsList.map(material => [
                sanitizeText(material.title || '—'),
                material.created_at ? new Date(material.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                material.last_accessed ? new Date(material.last_accessed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never',
                (material.view_count || 0).toString()
            ]);

            void tableData;

            autoTable(doc, {
                head: [['Title', 'Year', 'Last Accessed', 'Inactive', 'Views', 'Reason', 'Action']],
                body: detailedDormantRows,
                startY: yPos,
                margin: 14,
                theme: 'striped',
                headStyles: { fillColor: [21, 90, 143], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7, cellPadding: 2, valign: 'top' },
                columnStyles: {
                    0: { cellWidth: 58, halign: 'left' },
                    1: { cellWidth: 14, halign: 'center' },
                    2: { cellWidth: 22, halign: 'center' },
                    3: { cellWidth: 18, halign: 'right' },
                    4: { cellWidth: 14, halign: 'right' },
                    5: { cellWidth: 28, halign: 'left' },
                    6: { cellWidth: 28, halign: 'left' }
                },
                didDrawPage: (data) => {
                    const pageCount = doc.getNumberOfPages();
                    const pageSize = doc.internal.pageSize;
                    const pageHeight = pageSize.height;

                    if (pageCount > 1) {
                        doc.setFontSize(10);
                        doc.text(`Page ${pageCount}`, 14, pageHeight - 10);
                    }
                }
            });

            doc.save(`LitPathAI_DormantMaterials_KPI_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('Dormant materials exported to PDF successfully!', 'success');
        } catch (error) {
            console.error("Dormant materials PDF export failed:", error);
            showToast('Failed to export dormant materials to PDF. Please try again.', 'error');
        }
    };

    const handleTopRatedExportCSV = () => {
        try {
            if (!topRatedMaterials || topRatedMaterials.length === 0) {
                showToast('No top rated materials to export', 'error');
                return;
            }

            const rows = [];
            const exportDate = new Date().toLocaleDateString();

            const escape = (text) => {
                if (text === null || text === undefined) return '';
                const str = String(text);
                return `"${str.replace(/"/g, '""')}"`;
            };

            const getLocalDateString = () => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Header
            rows.push(["LITPATH AI - TOP RATED MATERIALS REPORT"]);
            rows.push(["Export Date", exportDate]);
            rows.push(["Total Materials", topRatedMaterials.length]);
            rows.push([]);

            // Columns
            rows.push(["Title", "Helpful Votes", "Not Relevant Votes", "Total Votes", "Relevance %"]);

            topRatedMaterials.forEach(item => {
                rows.push([
                    escape(item.title || ''),
                    escape(item.helpful || 0),
                    escape(item.notRelevant || 0),
                    escape(item.total || 0),
                    escape(item.relevanceRounded != null ? item.relevanceRounded + '%' : '')
                ]);
            });

            const csvContent = rows.map(row => row.join(',')).join('\r\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `LitPathAI_TopRatedMaterials_${getLocalDateString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('Top rated materials exported to CSV successfully!', 'success');
        } catch (error) {
            console.error('Top rated CSV export failed:', error);
            showToast('Failed to export top rated materials. Please try again.', 'error');
        }
    };

    const handleTopRatedExportPDF = async () => {
        try {
            if (!topRatedMaterials || topRatedMaterials.length === 0) {
                showToast('No top rated materials to export', 'error');
                return;
            }

            const { jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 20;

            const sanitizeText = (text) => {
                if (!text) return '';
                return String(text)
                    .replace(/º/g, 'o')
                    .replace(/ª/g, 'a')
                    .replace(/°/g, 'o')
                    .replace(/²/g, '^2')
                    .replace(/³/g, '^3')
                    .replace(/¹/g, '^1');
            };

            doc.setFontSize(12);
            doc.text(sanitizeText('LITPATH AI - TOP RATED MATERIALS REPORT'), pageWidth / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.text(`Total Materials: ${topRatedMaterials.length}`, 14, yPos);
            yPos += 8;

            const body = topRatedMaterials.map(item => [
                item.title || '',
                String(item.helpful || 0),
                String(item.notRelevant || 0),
                String(item.total || 0),
                String(item.relevanceRounded != null ? item.relevanceRounded + '%' : '')
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [[ 'Title', 'Helpful', 'Not Relevant', 'Total', 'Relevance %' ]],
                body: body,
                styles: { fontSize: 9 },
                headStyles: { fillColor: [30,116,188] }
            });

            doc.save(`LitPathAI_TopRatedMaterials_${new Date().toISOString().slice(0,10)}.pdf`);
            showToast('Top rated materials exported to PDF successfully!', 'success');
        } catch (error) {
            console.error('Top rated PDF export failed:', error);
            showToast('Failed to export top rated materials to PDF. Please try again.', 'error');
        }
    };

    // ---------- RENDER ----------
    return (
        <>
        {/* Inject CSS to hide browser's default password eye icons */}
        <style>{hideDefaultPasswordEyeStyles}</style>

        <div className="h-screen w-screen bg-gray-100 flex flex-col overflow-hidden font-sans">

            {/* Toast */}
            {toast.show && (
                <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-xl text-sm font-bold text-white animate-slideDown ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                    {toast.message}
                </div>
            )}

            {/* Feedback Details Modal */}
            {showFeedbackModal && selectedFeedback && (
                <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-fadeIn flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] text-white p-4 flex-none">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">Review Feedback</h2>
                                </div>
                                <button
                                    type="button"
                                    title="Close feedback modal"
                                    onClick={() => setShowFeedbackModal(false)}
                                    className="text-white hover:text-gray-200 transition-colors p-1"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column - Client Feedback */}
                                <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                                        <h3 className="text-l font-bold text-gray-800">Client Feedback</h3>
                                    </div>
                                    <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
                                        {/* Data Privacy Consent */}
                                        <div className="flex-none">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                                                Data Privacy Consent
                                            </label>
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                                                {selectedFeedback.consent_given ? (
                                                    <span className="text-green-700 font-medium">✓ Consent given</span>
                                                ) : (
                                                    <span className="text-red-600 font-medium">✗ Consent not given</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Client Profile */}
                                        <div className="flex-none">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                                                Client Profile
                                            </label>
                                            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                                                <span className="text-gray-600">Client Type:</span>
                                                <span className="font-medium">{getDisplayClientType(selectedFeedback)}</span>
                                                <span className="text-gray-600">Date of Interaction:</span>
                                                <span className="font-medium">{selectedFeedback.date ? new Date(selectedFeedback.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
                                                <span className="text-gray-600">Sex:</span>
                                                <span className="font-medium">{selectedFeedback.sex || '—'}</span>
                                                <span className="text-gray-600">Age:</span>
                                                <span className="font-medium">{selectedFeedback.age || '—'}</span>
                                                <span className="text-gray-600">Region:</span>
                                                <span className="font-medium">{selectedFeedback.region || '—'}</span>
                                            </div>
                                        </div>

                                        {/* Feedback & Evaluation */}
                                        <div className="flex-none">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                                                Feedback & Evaluation
                                            </label>
                                            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <div>
                                                    <span className="text-gray-600 text-sm">LitPath AI Rating:</span>
                                                    <div className="flex items-center mt-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                size={20}
                                                                className={`${
                                                                    selectedFeedback.litpath_rating >= star
                                                                        ? 'text-yellow-400 fill-yellow-400'
                                                                        : 'text-gray-300'
                                                                } mr-1`}
                                                            />
                                                        ))}
                                                        <span className="ml-2 text-sm font-medium">
                                                            {selectedFeedback.litpath_rating ? `${selectedFeedback.litpath_rating}/5` : 'No rating'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 text-sm">Research Interests:</span>
                                                    <p className="mt-1 text-sm bg-white p-3 rounded border border-gray-200">
                                                        {selectedFeedback.research_interests || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 text-sm">Missing Content:</span>
                                                    <p className="mt-1 text-sm bg-white p-3 rounded border border-gray-200">
                                                        {selectedFeedback.missing_content || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 text-sm">Message / Comment:</span>
                                                    <p className="mt-1 text-sm bg-white p-3 rounded border border-gray-200">
                                                        {selectedFeedback.message_comment || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column (Analysis & Action) */}
                                <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                                        <h3 className="text-l font-bold text-gray-800">Analysis & Action</h3>
                                    </div>
                                    <div className="p-4 flex-1 overflow-y-auto space-y-6">
                                        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Last edited</p>
                                                    <p className="mt-1 text-sm font-medium text-gray-800">
                                                        {selectedFeedback.last_edited_by_name
                                                            ? `${selectedFeedback.last_edited_by_name}${selectedFeedback.last_edited_by ? ` (ID: ${selectedFeedback.last_edited_by})` : ''}`
                                                            : 'No edits recorded yet'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {selectedFeedback.last_edited_at
                                                            ? new Date(selectedFeedback.last_edited_at).toLocaleString()
                                                            : 'Timestamp will appear after the first edit'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowFeedbackHistory((prev) => !prev)}
                                                    className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                                >
                                                    {showFeedbackHistory ? 'Hide history' : 'View history'}
                                                </button>
                                            </div>

                                            {showFeedbackHistory && (
                                                <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                                                    {Array.isArray(selectedFeedback.edit_history) && selectedFeedback.edit_history.length > 0 ? (
                                                        [...selectedFeedback.edit_history].reverse().map((entry, index) => (
                                                            <div key={`${entry.edited_at || index}-${index}`} className="rounded-lg border border-blue-100 bg-white p-3 text-sm shadow-sm">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <p className="font-semibold text-gray-800">
                                                                        {entry.edited_by_name || 'Unknown editor'}
                                                                        {entry.edited_by_id ? ` (ID: ${entry.edited_by_id})` : ''}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {entry.edited_at ? new Date(entry.edited_at).toLocaleString() : '—'}
                                                                    </p>
                                                                </div>
                                                                <div className="mt-2 space-y-2">
                                                                    {(entry.changes || []).map((change, changeIndex) => (
                                                                        <div key={`${change.field || changeIndex}-${changeIndex}`} className="rounded-md bg-blue-50 px-3 py-2 text-xs text-gray-700">
                                                                            <p className="font-semibold text-gray-800">{change.label || change.field || 'Field'}</p>
                                                                            <p>From: {formatAuditValue(change.old_value)}</p>
                                                                            <p>To: {formatAuditValue(change.new_value)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="rounded-lg border border-dashed border-blue-200 bg-white px-3 py-4 text-xs text-gray-500">
                                                            No edit history yet.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status - Editable */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Status <span className="text-red-500">*</span>
                                            </label>
                                            {isEditingFeedback ? (
                                                <select
                                                    aria-label="Select feedback status"
                                                    className="w-full border-gray-300 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                                                    value={feedbackEditForm.status}
                                                    onChange={(e) => setFeedbackEditForm({ ...feedbackEditForm, status: e.target.value })}
                                                >
                                                    <option value="" disabled>Select Status</option>
                                                    <option value="Pending">Pending</option>
                                                    <option value="Reviewed">Reviewed</option>
                                                    <option value="Resolved">Resolved</option>
                                                </select>
                                            ) : (
                                                <span className={`px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-full ${
                                                    selectedFeedback.status === 'Resolved' ? 'bg-green-100 text-green-800' : ''
                                                }${selectedFeedback.status === 'Reviewed' ? 'bg-blue-100 text-blue-800' : ''}
                                                ${selectedFeedback.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : ''}`}>
                                                    {selectedFeedback.status || 'Pending'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Category - Editable */}
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Feedback Type <span className="text-red-500">*</span>
                                            </label>
                                            {isEditingFeedback ? (
                                                <select
                                                    aria-label="Select admin category"
                                                    className="w-full border-gray-300 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                                                    value={feedbackEditForm.admin_category}
                                                    onChange={(e) => setFeedbackEditForm({ ...feedbackEditForm, admin_category: e.target.value })}
                                                >
                                                    <option value="" disabled>Select Feedback Type</option>
                                                    <option value="Irrelevant">Irrelevant</option>
                                                    <option value="Positive">Positive</option>
                                                    <option value="Issue">Issue / Bug</option>
                                                    <option value="For Improvement">For Improvement</option>
                                                </select>
                                            ) : (
                                                <span className="px-3 py-2 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                                    {selectedFeedback.admin_category || selectedFeedback.category || 'General'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Valid? - Editable */}
                                        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Is this valid? <span className="text-red-500">*</span>
                                            </label>
                                            {isEditingFeedback ? (
                                                <div className="flex gap-3 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeedbackEditForm({ ...feedbackEditForm, is_valid: true })}
                                                        className={`flex-1 py-2 text-sm font-semibold border rounded-lg transition-all ${
                                                            feedbackEditForm.is_valid === true
                                                                ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]'
                                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeedbackEditForm({ ...feedbackEditForm, is_valid: false })}
                                                        className={`flex-1 py-2 text-sm font-semibold border rounded-lg transition-all ${
                                                            feedbackEditForm.is_valid === false
                                                                ? 'bg-red-600 text-white border-red-600 shadow-md transform scale-[1.02]'
                                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {selectedFeedback.is_valid === true ? (
                                                        <span className="text-green-600 font-semibold">✓ Yes</span>
                                                    ) : selectedFeedback.is_valid === false ? (
                                                        <span className="text-red-600 font-semibold">✗ No</span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </div>
                                            )}
                                            {isEditingFeedback ? (
                                                <textarea
                                                    className="w-full border-gray-300 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                                    placeholder="Remarks (required) – explain why valid or invalid..."
                                                    rows="3"
                                                    value={feedbackEditForm.validity_remarks}
                                                    onChange={(e) => setFeedbackEditForm({ ...feedbackEditForm, validity_remarks: e.target.value })}
                                                />
                                            ) : (
                                                selectedFeedback.validity_remarks && (
                                                    <p className="mt-2 text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">
                                                        {selectedFeedback.validity_remarks}
                                                    </p>
                                                )
                                            )}
                                        </div>

                                        {/* Doable? - Editable */}
                                        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Is it doable? <span className="text-red-500">*</span>
                                            </label>
                                            {isEditingFeedback ? (
                                                <div className="flex gap-3 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeedbackEditForm({ ...feedbackEditForm, is_doable: true })}
                                                        className={`flex-1 py-2 text-sm font-semibold border rounded-lg transition-all ${
                                                            feedbackEditForm.is_doable === true
                                                                ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]'
                                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        Yes
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeedbackEditForm({ ...feedbackEditForm, is_doable: false })}
                                                        className={`flex-1 py-2 text-sm font-semibold border rounded-lg transition-all ${
                                                            feedbackEditForm.is_doable === false
                                                                ? 'bg-red-600 text-white border-red-600 shadow-md transform scale-[1.02]'
                                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        No
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {selectedFeedback.is_doable === true ? (
                                                        <span className="text-green-600 font-semibold">✓ Yes</span>
                                                    ) : selectedFeedback.is_doable === false ? (
                                                        <span className="text-red-600 font-semibold">✗ No</span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </div>
                                            )}
                                            {isEditingFeedback ? (
                                                <textarea
                                                    className="w-full border-gray-300 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                                    placeholder="Justification (required) – explain feasibility..."
                                                    rows="3"
                                                    value={feedbackEditForm.feasibility_remarks}
                                                    onChange={(e) => setFeedbackEditForm({ ...feedbackEditForm, feasibility_remarks: e.target.value })}
                                                />
                                            ) : (
                                                selectedFeedback.feasibility_remarks && (
                                                    <p className="mt-2 text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">
                                                        {selectedFeedback.feasibility_remarks}
                                                    </p>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="p-3.5 border-t border-gray flex gap-4 justify-end">
                                        {isEditingFeedback ? (
                                            <>
                                                <button
                                                    onClick={() => setIsEditingFeedback(false)}
                                                    className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveFeedbackFromModal}
                                                    className="px-8 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-md transition-all"
                                                >
                                                    Save Changes
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setIsEditingFeedback(true)}
                                                    className="px-8 py-2 bg-[#1E74BC] text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md transition-all"
                                                >
                                                    Edit
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-b from-[#555555] to-[#212121] text-white shadow-md flex-none z-50">
                <div className="flex items-center justify-between max-w-[100rem] mx-auto px-3 py-3 w-full">
                    <div className="flex items-center space-x-4">
                        <img src={dostLogo} alt="DOST Logo" className="h-12 w-auto pl-2" />
                        <div className="hidden md:block text-sm border-l border-white pl-4 ml-4 leading-tight opacity-100">
                            LitPath AI: <br /> Smart PathFinder for Theses and Dissertation
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden sm:block text-right">
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
                                    hour12: true
                                })}
                            </div>
                        </div>
                        <div className="relative" ref={userMenuRef}>
                            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 hover:bg-white/10 p-1.5 rounded transition-colors">
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md border border-white/20">
                                    {user?.username?.[0]?.toUpperCase() || 'A'}
                                </div>
                                <ChevronDown size={14} className="text-gray-400" />
                            </button>
                            {showUserMenu && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white text-gray-800 border border-gray-200 rounded-lg shadow-xl py-1 z-50">
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-sm font-bold">{user?.full_name || 'Admin User'}</p>
                                        <p className="text-xs text-gray-500 truncate">{user?.email || 'admin@litpath.ai'}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <ShieldCheck size={14} className="text-blue-600" />
                                            <span className="text-xs font-medium text-gray-700">{roleLabel}</span>
                                        </div>
                                    </div>
                                    {/* New Home button */}
                                    <button
                                        onClick={() => {
                                            navigate(ROLE_PATHS.STAFF_DASHBOARD);
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Home size={16} /> Home
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAccountSettings(true);
                                            setSettingsTab('profile');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Settings size={16} /> Account Settings
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">

                {/* Sidebar */}
                <aside className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-20 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
                    <div className={`h-16 flex items-center border-b border-gray-100 ${isSidebarOpen ? 'justify-start px-4' : 'justify-center p-0'}`}>
                        <button type="button" title="Toggle sidebar" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600">
                            <Menu size={24} />
                        </button>
                    </div>
                    <nav className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
                        {/* Dashboard Parent Section */}
                        <div>
                            <button 
                                onClick={() => setIsDashboardExpanded(!isDashboardExpanded)}
                                className={`w-full flex items-center p-3 rounded-lg transition-colors ${isSidebarOpen ? 'justify-between' : 'justify-center'} ${activeTab === 'overview' || activeTab === 'ratings' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <div className={`flex items-center ${isSidebarOpen ? '' : 'justify-center'}`}>
                                    <LayoutDashboard size={20} className="flex-shrink-0" />
                                    <span className={`text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100' : 'ml-0 opacity-0 w-0 overflow-hidden'}`}>Dashboard</span>
                                </div>
                                {isSidebarOpen && (
                                    <ChevronDown 
                                        size={18} 
                                        className={`flex-shrink-0 transition-transform duration-300 ${isDashboardExpanded ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>
                            
                            {/* Dashboard Child Items */}
                            {isDashboardExpanded && (
                                <div className={`mt-2 space-y-1 ${isSidebarOpen ? 'ml-4 border-l-2 border-gray-200 pl-2' : 'ml-0 border-l-0 pl-0'}`}>
                                    {/* Usage Analytics */}
                                    <button 
                                        onClick={() => handleTabChange('overview')}
                                        className={`w-full flex items-center p-3 rounded-lg text-sm transition-colors ${isSidebarOpen ? 'justify-start' : 'justify-center'} ${activeTab === 'overview' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        <TrendingUp size={18} className="flex-shrink-0" />
                                        <span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100' : 'ml-0 opacity-0 w-0 overflow-hidden'}`}>Usage Analytics</span>
                                    </button>
                                    
                                    {/* Material Ratings */}
                                    <button 
                                        onClick={() => handleTabChange('ratings')}
                                        className={`w-full flex items-center p-3 rounded-lg text-sm transition-colors ${isSidebarOpen ? 'justify-start' : 'justify-center'} ${activeTab === 'ratings' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        <Star size={18} className="flex-shrink-0" />
                                        <span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100' : 'ml-0 opacity-0 w-0 overflow-hidden'}`}>Material Ratings</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Feedback Manager - Top Level */}
                        <button 
                            onClick={() => handleTabChange('feedback')} 
                            className={`w-full flex items-center p-3 rounded-lg transition-colors ${isSidebarOpen ? 'justify-start' : 'justify-center'} ${activeTab === 'feedback' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            <MessageSquare size={20} className="flex-shrink-0" />
                            <span className={`text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'ml-3 opacity-100' : 'ml-0 opacity-0 w-0 overflow-hidden'}`}>Feedback Manager</span>
                        </button>
                    </nav>
                    <div className={`p-4 border-t border-gray-100 text-xs text-gray-400 text-center whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 p-0'}`}>
                        © 2025 LitPath AI
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 bg-gray-50 p-4 overflow-hidden flex flex-col relative">

                    {/* ===== LOADING OVERLAY ===== */}
                    {loading && (
                        <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center transition-opacity duration-300">
                            <RefreshCw size={40} className="animate-spin text-[#1E74BC] mb-4 shadow-sm rounded-full" />
                            <p className="text-gray-600 font-semibold animate-pulse tracking-wide">Gathering dashboard insights...</p>
                        </div>
                    )}

                    {/* ===== ERROR STATE ===== */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 text-center">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {/* ===== OVERVIEW TAB ===== */}
                    {activeTab === 'overview' && (
                        <div className="h-full overflow-y-auto pr-1">
                            <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-2">

                                {/* ===== HEADER + DATE FILTER ===== */}

                                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Thesis & Dissertation Usage</h2>
                                    <p className="text-sm text-gray-500">Track thesis and dissertation activity across the platform</p>
                                </div>
                                    <div className="flex gap-2">

                                        {/* EXPORT DROPDOWN BUTTON */}
                                        <div className="relative" ref={exportDropdownRef}>
                                            <button
                                                onClick={() => setShowExportDropdown(!showExportDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-[#1E74BC] rounded-md bg-white text-[#1E74BC] hover:bg-blue-50 text-xs font-bold transition-colors shadow-sm"
                                                title="Export current data"
                                            >
                                                <Download size={14} />
                                                <span>Export Data</span>
                                                <ChevronDown size={14} />
                                            </button>

                                            {showExportDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[180px]">
                                                    <button
                                                        onClick={() => {
                                                            handleExportCSV();
                                                            setShowExportDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 first:rounded-t-lg transition-colors"
                                                    >
                                                        Export as CSV
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleExportPDF();
                                                            setShowExportDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 last:rounded-b-lg transition-colors"
                                                    >
                                                        Export as PDF
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Date Filter Dropdown */}
                                        <div className="relative" ref={overviewDateDropdownRef}>
                                            <button
                                                onClick={() => setShowOverviewDateDropdown(!showOverviewDateDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-gray-400 rounded-md bg-white text-gray-650 hover:bg-gray-100 text-xs font-medium"
                                            >
                                                <Calendar size={14} />
                                                <span>
                                                    {overviewDateFilterType === 'Year' && `Year ${overviewSelectedYear}`}
                                                    {overviewDateFilterType === 'Month' && `${new Date(0, overviewSelectedMonth-1).toLocaleString('default', { month: 'long' })} ${overviewSelectedMonthYear}`}
                                                    {overviewDateFilterType === 'Last 7 days' && 'Last 7 days'}
                                                    {overviewDateFilterType === 'Custom range' && 'Custom range'}
                                                </span>
                                                <ChevronDown size={14} />
                                            </button>

                                            {showOverviewDateDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[260px] p-3">
                                                    {/* Filter type options */}
                                                    {overviewDateFilterOptions.map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => {
                                                                setOverviewDateFilterType(opt);
                                                                if (opt === 'Last 7 days') {
                                                                    setShowOverviewDateDropdown(false);
                                                                    fetchTrends();
                                                                }
                                                                if (opt !== 'Custom range') {
                                                                    setOverviewCustomFrom('');
                                                                    setOverviewCustomTo('');
                                                                }
                                                            }}
                                                            className={`block w-full text-left px-3 py-2 text-xs rounded-md ${
                                                                overviewDateFilterType === opt
                                                                    ? 'bg-blue-50 text-blue-600 font-bold'
                                                                    : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}

                                                    {/* Year picker */}
                                                    {overviewDateFilterType === 'Year' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                Select year
                                                            </label>
                                                            <select
                                                                aria-label="Select year for overview"
                                                                value={overviewSelectedYear}
                                                                onChange={(e) => setOverviewSelectedYear(parseInt(e.target.value))}
                                                                className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                            >
                                                                {yearOptions.map(year => (
                                                                    <option key={year} value={year}>{year}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => {
                                                                    setShowOverviewDateDropdown(false);
                                                                    fetchTrends();
                                                                }}
                                                                className="w-full mt-3 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Month picker */}
                                                    {overviewDateFilterType === 'Month' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <div className="flex flex-col gap-2">
                                                                <div>
                                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                        Month
                                                                    </label>
                                                                    <select
                                                                        aria-label="Select month for overview filter"
                                                                        value={overviewSelectedMonth}
                                                                        onChange={(e) => setOverviewSelectedMonth(parseInt(e.target.value))}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                    >
                                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                                            <option key={month} value={month}>
                                                                                {new Date(0, month-1).toLocaleString('default', { month: 'long' })}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                        Year
                                                                    </label>
                                                                    <select
                                                                        aria-label="Select year for overview month filter"
                                                                        value={overviewSelectedMonthYear}
                                                                        onChange={(e) => setOverviewSelectedMonthYear(parseInt(e.target.value))}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                    >
                                                                        {yearOptions.map(year => (
                                                                            <option key={year} value={year}>{year}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setShowOverviewDateDropdown(false);
                                                                        fetchTrends();
                                                                    }}
                                                                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                                >
                                                                    Apply
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Custom range picker */}
                                                    {overviewDateFilterType === 'Custom range' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <div className="flex flex-col gap-2">
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500 mb-1 block">From</span>
                                                                    <input
                                                                        type="date"
                                                                        value={overviewCustomFrom}
                                                                        onChange={(e) => setOverviewCustomFrom(e.target.value)}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500 mb-1 block">To</span>
                                                                    <input
                                                                        type="date"
                                                                        value={overviewCustomTo}
                                                                        onChange={(e) => setOverviewCustomTo(e.target.value)}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        if (overviewCustomFrom && overviewCustomTo) {
                                                                            setShowOverviewDateDropdown(false);
                                                                            fetchTrends();
                                                                        } else {
                                                                            showToast('Select both dates', 'error');
                                                                        }
                                                                    }}
                                                                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                                >
                                                                    Apply Range
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Clear Filter button – resets to current year */}
                                                    <div className="mt-3 pt-2 border-t border-gray-100">
                                                        <button
                                                            onClick={() => {
                                                                setOverviewDateFilterType('Year');
                                                                setOverviewSelectedYear(new Date().getFullYear());
                                                                setOverviewSelectedMonth(new Date().getMonth() + 1);
                                                                setOverviewSelectedMonthYear(new Date().getFullYear());
                                                                setOverviewCustomFrom('');
                                                                setOverviewCustomTo('');
                                                                setShowOverviewDateDropdown(false);
                                                                fetchTrends();
                                                            }}
                                                            disabled={overviewDateFilterType === 'Year' && overviewSelectedYear === new Date().getFullYear()}
                                                            className={`w-full text-xs py-1.5 rounded border transition-colors ${
                                                                overviewDateFilterType === 'Year' && overviewSelectedYear === new Date().getFullYear()
                                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-red-600'
                                                            }`}
                                                        >
                                                            Reset to Current Year
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ===== KPI CARDS – LARGER TITLES & ICONS ===== */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                                    
                                    {/* Total Theses */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <BookOpen size={18} className="text-blue-600" /> Total Theses
                                            </p>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Total number of thesis/dissertation documents in the database.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(dashboardData.kpi.totalDocuments)}</p>
                                    </div>

                                    {/* Total Searches – same pattern, just change tooltip text */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <Search size={18} className="text-green-600" /> Total Searches
                                            </p>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Number of search queries performed in the selected period.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(dashboardData.kpi.totalSearches)}</p>
                                    </div>

                                    {/* Collection Utilisation */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <BarChart3 size={18} className="text-amber-600" /> Collection Utilisation
                                            </p>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Percentage of documents accessed at least once vs. total documents.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-2 mt-2">
                                            <p className="text-2xl font-bold text-gray-900">{dashboardData.kpi.utilizationPercent}%</p>
                                            <p className="text-sm text-gray-500 mb-1">
                                                ({dashboardData.kpi.accessedDocuments}/{dashboardData.kpi.totalDocuments})
                                            </p>
                                        </div>
                                    </div>

                                    {/* Avg Response Time */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <Clock size={18} className="text-purple-600" /> Avg Response Time
                                            </p>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Average time (in milliseconds) to process a search query.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(dashboardData.kpi.avgResponseTime)} ms</p>
                                    </div>

                                    {/* Failed Queries */}
                                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <AlertCircle size={18} className="text-red-600" /> Failed Queries
                                            </p>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Number of searches that returned zero results.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(dashboardData.failedQueriesCount)}</p>
                                    </div>

                                </div>

                                {/* ===== MIDDLE SECTION: 3-COLUMN GRID ===== */}
                                <div className="grid grid-cols-12 gap-2">

                                    {/* COL 1: TRENDING TOPICS (25%) */}
                                    <div className="col-span-12 lg:col-span-3 flex flex-col gap-2">
                                        {/* Trending Topics Card */}
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex-1">
                                            <div className="flex items-center gap-1 mb-4">
                                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-blue-600" /> TRENDING TOPICS
                                                </h3>
                                                {/* Info icon for view count explanation */}
                                                <div className="relative group">
                                                    <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                        <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                            Number of views in the selected period. Growth percentage compared to previous period; may exceed 100% for new topics.
                                                        </div>
                                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4 flex-1">
                                                {dashboardData.trendingTopics.length > 0 ? (
                                                    dashboardData.trendingTopics.map((item, i) => {
                                                        // Updated colors: positive growth now emerald (vibrant green)
                                                        const barColor = item.growth > 0 ? 'bg-emerald-500' : item.growth < 0 ? 'bg-red-400' : 'bg-gray-400';
                                                        const arrow = item.growth > 0 ? '↑' : item.growth < 0 ? '↓' : '–';
                                                        const textColor = item.growth > 0 ? 'text-emerald-700' : item.growth < 0 ? 'text-red-700' : 'text-gray-500';
                                                        const maxViews = Math.max(...dashboardData.trendingTopics.map(t => t.current_views), 1);
                                                        const barWidth = (item.current_views / maxViews) * 100;
                                                        return (
                                                            <div
                                                                key={i}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => handleOpenTopicMaterialsModal(item)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        handleOpenTopicMaterialsModal(item);
                                                                    }
                                                                }}
                                                                className="flex flex-col gap-1 cursor-pointer group/topic rounded-md px-1 py-0.5 -mx-1 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#1E74BC] focus:ring-offset-1 transition-colors"
                                                            >
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-gray-700 truncate max-w-[60%]" title={item.subject}>
                                                                        {i+1}. {item.subject}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-gray-900">{item.current_views}</span>
                                                                        <span className={`text-[10px] font-bold ${textColor} flex items-center`}>
                                                                            {arrow} {Math.abs(item.growth)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full ${barColor} transition-all duration-300`}
                                                                        style={{ width: `${barWidth}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-[#1E74BC] font-semibold opacity-0 group-hover/topic:opacity-100 transition-opacity">
                                                                    Click to view materials
                                                                </span>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-gray-400 italic">Not enough data yet</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Top Failed Queries */}
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex-1">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1">
                                                    <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                        <AlertCircle size={16} className="text-red-600" /> Top Failed Queries
                                                    </h3>
                                                    <div className="relative group">
                                                        <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                            <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                                Specific keywords/queries that returned zero results.
                                                            </div>
                                                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleOpenAllFailedQueriesModal}
                                                    className="text-[12px] font-semibold text-[#1E74BC] hover:text-[#155a8f] hover:underline transition-colors"
                                                >
                                                    View all
                                                </button>
                                            </div>
                                            {dashboardData.failedQueries && dashboardData.failedQueries.length > 0 ? (
                                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                                    {dashboardData.failedQueries.map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2 text-xs bg-red-50 border border-red-100 rounded px-3 py-2">
                                                            <span className="text-gray-700 truncate flex-1 font-medium">{item.query}</span>
                                                            <span className="text-red-600 font-bold flex-shrink-0 bg-red-100 px-2 py-0.5 rounded">{item.count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic text-center py-4">No failed queries recorded</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* COL 2: MOST VIEWED THESES - LEADERBOARD STYLE (50%) */}
                                    <div className="col-span-12 lg:col-span-6 bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col overflow-visible">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-1">
                                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                    <BookOpen size={16} className="text-purple-600" /> Most Viewed Theses
                                                </h3>
                                                <div className="relative group">
                                                    <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-56">
                                                        <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                            Ranked by number of views within the selected date range.
                                                        </div>
                                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleOpenAllThesesModal}
                                                className="text-[12px] font-semibold text-[#1E74BC] hover:text-[#155a8f] hover:underline transition-colors"
                                            >
                                                View all
                                            </button>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                                            {dashboardData.topTheses.slice(0, 8).map((item, i) => (
                                                <div
                                                    key={i}
                                                    className={`relative flex items-center gap-4 p-3 rounded-lg border transition-all ${
                                                        i === 0 ? 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200 shadow-sm' :
                                                        i === 1 ? 'bg-gradient-to-r from-gray-50 to-white border-gray-200' :
                                                        i === 2 ? 'bg-gradient-to-r from-orange-50 to-white border-orange-100' :
                                                        'bg-white border-gray-100 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {/* Rank Icon */}
                                                    <div className="flex-shrink-0">
                                                        {getRankIcon(i)}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs truncate leading-relaxed ${i === 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}
                                                        title={item.title}>
                                                            {item.title}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 truncate mt-2">{item.author || 'Unknown Author'}</p>
                                                    </div>

                                                    {/* Views */}
                                                    <div className="flex-shrink-0 text-right pl-2">
                                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                                                            i === 0 ? 'bg-yellow-100 border-yellow-200 text-yellow-800' :
                                                            'bg-gray-100 border-gray-200 text-gray-600'
                                                        }`}>
                                                            <Eye size={12} className={i === 0 ? "text-yellow-700" : "text-gray-400"} />
                                                            <span className="font-bold text-xs">{formatNumber(item.view_count)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {dashboardData.topTheses.length === 0 && <p className="text-xs text-gray-400 italic">No views recorded</p>}
                                        </div>
                                    </div>

                                    {/* COL 3: USERS & GENDER DISTRIBUTION (25%) */}
                                    <div className="col-span-12 lg:col-span-3 flex flex-col gap-2">

                                        {/* Users by Category */}
                                        <div ref={usersByCategoryChartRef} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex-1">
                                            <div className="flex items-center gap-1 mb-4">
                                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                    <Users size={16} className="text-indigo-600" /> Users by Category
                                                </h3>
                                                <div className="relative group">
                                                    <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                        <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                            Distribution of users by their self‑identified category from CSM feedback.
                                                        </div>
                                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {dashboardData.usageByCategory.length > 0 ? (() => {
                                                const totalUsers = dashboardData.usageByCategory.reduce((sum, c) => sum + (c.views || 0), 0);
                                                const topCategory = [...dashboardData.usageByCategory].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
                                                const zeroCategories = dashboardData.usageByCategory.filter(c => (c.views || 0) === 0);

                                                return (
                                                    <>
                                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-4">
                                                            <p className="text-xs text-indigo-900">
                                                                <span className="font-bold">{totalUsers}</span> total users
                                                                {topCategory && topCategory.views > 0 && (
                                                                    <> — mostly <span className="font-semibold">{topCategory.category}</span> ({topCategory.views})</>
                                                                )}
                                                                {zeroCategories.length > 0 && (
                                                                    <> · {zeroCategories.length} categor{zeroCategories.length === 1 ? 'y' : 'ies'} with no users yet</>
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div className="space-y-5">
                                                            {dashboardData.usageByCategory.map((cat, i) => {
                                                                const Icon = cat.category.includes('Student') ? GraduationCap :
                                                                            cat.category.includes('DOST') ? Briefcase :
                                                                            cat.category.includes('Librarian') ? BookOpen : Users;
                                                                return (
                                                                    <div key={i} className="flex flex-col gap-1">
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <Icon size={12} className="text-gray-500" />
                                                                                <span className="font-medium text-gray-700">{cat.category}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="font-semibold text-gray-900">{cat.views || 0}</span>
                                                                                <span className="text-[10px] text-gray-400">({cat.percentage}%)</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-indigo-500 rounded-full"
                                                                                style={{ width: `${cat.percentage}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                );
                                            })() : (
                                                <p className="text-xs text-gray-400 italic">No user data.</p>
                                            )}
                                        </div>

                                        {/* Gender Distribution */}
                                        <div ref={genderDistributionChartRef} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex-1">
                                            <div className="mb-3">
                                                <div className="flex items-center gap-1">
                                                    <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                        <Users size={16} className="text-purple-600" /> Gender Distribution
                                                    </h3>
                                                    <div className="relative group">
                                                        <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-56">
                                                            <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                                Gender breakdown of users who registered and submitted feedback.
                                                            </div>
                                                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] italic text-gray-400 mt-0.5">Click a segment to view details</p>
                                            </div>
                                            {(() => {
                                                const gendersWithData = dashboardData.genderDistribution
                                                    .filter(g => g.count > 0)
                                                    .sort((a, b) => b.count - a.count);
                                                const total = dashboardData.genderDistribution.reduce((sum, g) => sum + g.count, 0);

                                                const colorPalette = ['#3b82f6', '#ef4444', '#f97316'];

                                                if (gendersWithData.length === 0) {
                                                    return <p className="text-xs text-gray-400 italic">No records yet</p>;
                                                }

                                                // Build segments with start/end angles (0-360) for both gradient and SVG hit areas
                                                let cumulativePercent = 0;
                                                const segments = gendersWithData.map((item, i) => {
                                                    const percentage = (item.count / total) * 100;
                                                    const startPercent = cumulativePercent;
                                                    cumulativePercent += percentage;
                                                    const endPercent = cumulativePercent;
                                                    return {
                                                        ...item,
                                                        color: colorPalette[i % colorPalette.length],
                                                        startPercent,
                                                        endPercent,
                                                        startAngle: startPercent * 3.6,
                                                        endAngle: endPercent * 3.6
                                                    };
                                                });

                                                const gradientStops = segments.map(s => `${s.color} ${s.startPercent}% ${s.endPercent}%`).join(', ');

                                                // Convert angle (0-360, starting at top, clockwise) to SVG path sector
                                                const getSectorPath = (startAngle, endAngle, outerRadius = 16, innerRadius = 0) => {
                                                    const toRad = (deg) => (deg - 90) * (Math.PI / 180);
                                                    const startRad = toRad(startAngle);
                                                    const endRad = toRad(endAngle);
                                                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                                                    const x1 = 16 + outerRadius * Math.cos(startRad);
                                                    const y1 = 16 + outerRadius * Math.sin(startRad);
                                                    const x2 = 16 + outerRadius * Math.cos(endRad);
                                                    const y2 = 16 + outerRadius * Math.sin(endRad);
                                                    return `M 16 16 L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                                };

                                                return (
                                                    <div className="flex flex-col items-center gap-5 w-full justify-center h-full">
                                                        {/* Donut chart with clickable overlay */}
                                                        <div className="relative w-32 h-32 flex-shrink-0">
                                                            <div
                                                                className="w-full h-full rounded-full transition-all"
                                                                style={{
                                                                    background: `conic-gradient(${gradientStops})`,
                                                                    mask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                                    WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                                    filter: hoveredGenderSegment !== null ? 'brightness(1.05)' : 'none'
                                                                }}
                                                            />
                                                            <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full">
                                                                {segments.map((seg, i) => (
                                                                    <path
                                                                        key={i}
                                                                        d={getSectorPath(seg.startAngle, seg.endAngle)}
                                                                        fill="transparent"
                                                                        stroke="transparent"
                                                                        pointerEvents="all"
                                                                        onMouseEnter={() => setHoveredGenderSegment(i)}
                                                                        onMouseLeave={() => setHoveredGenderSegment(null)}
                                                                        onClick={() => handleOpenGenderDetailModal(seg)}
                                                                        style={{ cursor: 'pointer' }}
                                                                    />
                                                                ))}
                                                            </svg>
                                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 pointer-events-none">
                                                                {total} total
                                                            </div>
                                                        </div>
                                                        {/* Legend */}
                                                        <div className="w-full space-y-2 max-h-40 overflow-y-auto pr-1">
                                                            {segments.map((item, i) => (
                                                                <div
                                                                    key={i}
                                                                    onClick={() => handleOpenGenderDetailModal(item)}
                                                                    onMouseEnter={() => setHoveredGenderSegment(i)}
                                                                    onMouseLeave={() => setHoveredGenderSegment(null)}
                                                                    className={`flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1.5 -mx-1 transition-colors ${
                                                                        hoveredGenderSegment === i ? 'bg-purple-50 font-semibold' : ''
                                                                    }`}
                                                                >
                                                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                                    <span className="flex-1 truncate" title={item.gender}>
                                                                        {item.gender}
                                                                    </span>
                                                                    <span className="font-semibold text-gray-700">
                                                                        {item.count} ({item.percentage}%)
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>


                                    </div>
                                </div>

                                {/* ===== BOTTOM SECTION: ACTIVITY TRENDS + CITATIONS ===== */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                                    {/* Activity Trends */}
                                    <div ref={activityTrendsChartRef} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 min-h-[200px] flex flex-col">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <div className="flex items-center gap-1">
                                                    <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                        <Calendar size={16} className="text-blue-600" /> Activity Trends
                                                    </h3>
                                                    <div className="relative group">
                                                        <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                            <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center font-normal normal-case tracking-normal">
                                                                Number of material views within the selected date range.
                                                            </div>
                                                            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <span className="text-[10px] text-gray-500 italic ml-2">
                                                    {overviewDateFilterType === 'Year' && `(Monthly material views for ${overviewSelectedYear})`}
                                                    {overviewDateFilterType === 'Month' && `(Weekly material views for ${new Date(0, overviewSelectedMonth - 1).toLocaleString('default', { month: 'long' })} ${overviewSelectedMonthYear})`}
                                                    {overviewDateFilterType === 'Last 7 days' && '(Daily material views from the last 7 days)'}
                                                    {overviewDateFilterType === 'Custom range' && overviewCustomFrom && overviewCustomTo &&
                                                        `(Material views summary from ${new Date(overviewCustomFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${new Date(overviewCustomTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                                                    }
                                                </span>
                                                
                                            </div>
                                        </div>

                                        {/* Dynamic Total and Chart Rendering */}
                                        {(() => {
                                            const totalActivityViews = dashboardData.trends ? dashboardData.trends.reduce((sum, t) => sum + t.views, 0) : 0;

                                            return dashboardData.trends && dashboardData.trends.length > 0 ? (
                                                <>
                                                    <p className="text-2xl font-bold text-gray-900">{formatNumber(totalActivityViews)}</p>
                                                    <p className="text-xs text-gray-500 mb-2">total material views in this period. <p className="text-[10px] italic text-gray-400 mt-1">Click a bar to view materials from that period</p></p>
                                                    

                                                    {(() => {
                                                        const max = Math.max(...dashboardData.trends.map(t => t.views), 1);
                                                        // Helper to format Y-axis accurately
                                                        const tick = (mult) => {
                                                            const val = max * mult;
                                                            return max < 4 ? val.toFixed(1) : formatNumber(Math.round(val));
                                                        };

                                                        return (
                                                            <>
                                                                {/* mt-10 provides safe airspace for tooltips so they never clip the top container */}
                                                                <div className="flex w-full mt-10 h-[150px] relative">
                                                                    
                                                                    {/* Y-Axis Labels - Absolutely positioned for perfect line alignment */}
                                                                    <div className="relative w-10 shrink-0">
                                                                        <span className="absolute right-2 top-0 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(1)}</span>
                                                                        <span className="absolute right-2 top-[25%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.75)}</span>
                                                                        <span className="absolute right-2 top-[50%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.5)}</span>
                                                                        <span className="absolute right-2 top-[75%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.25)}</span>
                                                                        <span className="absolute right-2 bottom-0 translate-y-1/2 text-[10px] text-gray-400 font-medium">0</span>
                                                                    </div>

                                                                    {/* Chart Area */}
                                                                    <div className="flex-1 relative border-b-2 border-l-2 border-gray-200">
                                                                        
                                                                        {/* Horizontal Grid Lines - fixed z-index so they show up! */}
                                                                        <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 z-0"></div>
                                                                        <div className="absolute inset-x-0 top-[25%] border-t border-dashed border-gray-200 z-0"></div>
                                                                        <div className="absolute inset-x-0 top-[50%] border-t border-dashed border-gray-200 z-0"></div>
                                                                        <div className="absolute inset-x-0 top-[75%] border-t border-dashed border-gray-200 z-0"></div>

                                                                        {/* Bars Container */}
                                                                        <div className="absolute inset-0 flex items-end justify-around gap-1">
                                                                            {dashboardData.trends.map((item, i) => {
                                                                                const heightPercent = item.views === 0 ? 0 : Math.max((item.views / max) * 100, 1);
                                                                                
                                                                                let displayLabel = '';
                                                                                if (overviewDateFilterType === 'Year') {
                                                                                    displayLabel = item.month ? item.month.substring(0, 3) : '';
                                                                                } else if (overviewDateFilterType === 'Month' || overviewDateFilterType === 'Last 7 days' || overviewDateFilterType === 'Custom range') {
                                                                                    displayLabel = item.label;
                                                                                }

                                                                                let tooltipContent;
                                                                                if (overviewDateFilterType === 'Year') {
                                                                                    tooltipContent = (
                                                                                        <div className="text-center">
                                                                                            <div className="font-semibold text-gray-200">{item.month} {item.year}:</div>
                                                                                            <div>{item.views} view{item.views !== 1 ? 's' : ''}</div>
                                                                                        </div>
                                                                                    );
                                                                                } else if (overviewDateFilterType === 'Month' || overviewDateFilterType === 'Custom range') {
                                                                                    tooltipContent = (
                                                                                        <div className="text-center">
                                                                                            <div className="font-semibold text-gray-200">{item.tooltipRange}:</div>
                                                                                            <div>{item.views} view{item.views !== 1 ? 's' : ''}</div>
                                                                                        </div>
                                                                                    );
                                                                                } else if (overviewDateFilterType === 'Last 7 days') {
                                                                                    tooltipContent = (
                                                                                        <div className="text-center">
                                                                                            <div className="font-semibold text-gray-200">{item.fullDate}, {item.weekday}:</div>
                                                                                            <div>{item.views} view{item.views !== 1 ? 's' : ''}</div>
                                                                                        </div>
                                                                                    );
                                                                                }

                                                                                const isFirst = i === 0;
                                                                                const isLast = i === dashboardData.trends.length - 1;
                                                                                let tooltipPositionClass = "left-1/2 -translate-x-1/2"; 
                                                                                let arrowPositionClass = "left-1/2 -translate-x-1/2";   

                                                                                if (isFirst) {
                                                                                    tooltipPositionClass = "left-0 translate-x-0";      
                                                                                    arrowPositionClass = "left-4 -translate-x-1/2";     
                                                                                } else if (isLast) {
                                                                                    tooltipPositionClass = "right-0 translate-x-0";     
                                                                                    arrowPositionClass = "right-4 translate-x-1/2";     
                                                                                }

                                                                                return (
                                                                                    /* hover:z-50 makes sure the active tooltip is ALWAYS on top of neighboring bars */
                                                                                    <div
                                                                                        key={i}
                                                                                        onClick={() => handleOpenActivityTrendDetailModal(item)}
                                                                                        className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative hover:z-50"
                                                                                    >
                                                                                        
                                                                                        {/* Ghost Background Track */}
                                                                                        <div className="absolute inset-y-0 bottom-0 w-full max-w-[32px] bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors rounded-t-sm z-0"></div>

                                                                                        {/* Actual Data Bar */}
                                                                                        <div
                                                                                            className={`w-full max-w-[32px] absolute bottom-0 z-10 rounded-t-sm transition-all duration-500 ${item.views > 0 ? 'bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-500 group-hover:to-blue-300 shadow-sm' : 'bg-transparent'}`}
                                                                                            style={{ height: `${heightPercent}%` }}
                                                                                        >
                                                                                            {/* Tooltip Wrapper - Added whitespace-nowrap here so text doesn't squish */}
                                                                                            <div className={`absolute bottom-full mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none ${tooltipPositionClass}`}>
                                                                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-1.5 rounded shadow-lg whitespace-nowrap w-max text-center leading-tight border border-gray-700">
                                                                                                    {tooltipContent}
                                                                                                </div>
                                                                                                <div className={`absolute -bottom-[4px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800 ${arrowPositionClass}`}></div>
                                                                                            </div>
                                                                                        </div>
                                                                                        
                                                                                        {/* X-Axis Label */}
                                                                                        <div className="absolute -bottom-7 text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap text-center">
                                                                                            {displayLabel}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {/* Spacer to protect X-Axis labels from bottom margin */}
                                                                <div className="h-8 w-full"></div>
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            ) : (
                                                <div className="w-full flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 opacity-50 min-h-[120px]">
                                                    <TrendingUp size={32} />
                                                    <span className="text-xs">No activity recorded yet</span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Citation Activity */}
                                    <div ref={citationActivityChartRef} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col">
                                        <div className="flex items-center gap-1 mb-3 flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                    <Copy size={16} className="text-red-600" /> Citation Activity
                                                </h3>
                                                <div className="relative group">
                                                    <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                        <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center font-normal normal-case tracking-normal">
                                                            Number of times citations were copied within the selected date range.
                                                        </div>
                                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <span className="text-[10px] text-gray-500 italic ml-2">
                                                {overviewDateFilterType === 'Year' && `(Monthly  citation copies for ${overviewSelectedYear})`}
                                                {overviewDateFilterType === 'Month' && `(Weekly  citation copies for ${new Date(0, overviewSelectedMonth - 1).toLocaleString('default', { month: 'long' })} ${overviewSelectedMonthYear})`}
                                                {overviewDateFilterType === 'Last 7 days' && '(Daily citation copies from the last 7 days)'}
                                                {overviewDateFilterType === 'Custom range' && overviewCustomFrom && overviewCustomTo &&
                                                    `(Citation copies summary from ${new Date(overviewCustomFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${new Date(overviewCustomTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                                                }
                                            </span>
                                        </div>
                                        
                                        {dashboardData.citationStats.total_copies > 0 ? (
                                            <>
                                                <p className="text-2xl font-bold text-gray-900">{formatNumber(dashboardData.citationStats.total_copies)}</p>
                                                <p className="text-xs text-gray-500 mb-2">total citation copies in this period <p className="text-[10px] italic text-gray-400 mt-1">Click a point to view citation details from that period</p></p>

                                                {(() => {
                                                    const max = Math.max(...dashboardData.citationTrends.map(m => m.copies), 1);
                                                    const dataLen = dashboardData.citationTrends.length;

                                                    // Helper to format Y-axis accurately
                                                    const tick = (mult) => {
                                                        const val = max * mult;
                                                        return max < 4 ? val.toFixed(1) : formatNumber(Math.round(val));
                                                    };
                                                    
                                                    const points = dashboardData.citationTrends.map((item, i) => {
                                                        const x = ((i + 0.5) / dataLen) * 100;
                                                        const y = 100 - ((item.copies / max) * 100); 
                                                        return { x, y, ...item };
                                                    });

                                                    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                                    const areaPath = `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

                                                    return (
                                                        <>
                                                            <div className="flex w-full mt-10 h-[150px] relative">
                                                                
                                                                {/* Y-Axis Labels */}
                                                                <div className="relative w-10 shrink-0">
                                                                    <span className="absolute right-2 top-0 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(1)}</span>
                                                                    <span className="absolute right-2 top-[25%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.75)}</span>
                                                                    <span className="absolute right-2 top-[50%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.5)}</span>
                                                                    <span className="absolute right-2 top-[75%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.25)}</span>
                                                                    <span className="absolute right-2 bottom-0 translate-y-1/2 text-[10px] text-gray-400 font-medium">0</span>
                                                                </div>
                                                                
                                                                {/* Chart Area */}
                                                                <div className="flex-1 relative border-b-2 border-l-2 border-gray-200">
                                                                    
                                                                    {/* Horizontal Grid Lines */}
                                                                    <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 z-0"></div>
                                                                    <div className="absolute inset-x-0 top-[25%] border-t border-dashed border-gray-200 z-0"></div>
                                                                    <div className="absolute inset-x-0 top-[50%] border-t border-dashed border-gray-200 z-0"></div>
                                                                    <div className="absolute inset-x-0 top-[75%] border-t border-dashed border-gray-200 z-0"></div>
                                                                    
                                                                    {/* SVG Area Fill */}
                                                                    <div className="absolute inset-0 w-full h-full overflow-visible z-10">
                                                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                                                            <defs>
                                                                                <linearGradient id="citationGradient" x1="0" x2="0" y1="0" y2="1">
                                                                                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                                                                                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                                                                                </linearGradient>
                                                                            </defs>
                                                                            <path d={areaPath} fill="url(#citationGradient)" />
                                                                            <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                        </svg>
                                                                    </div>

                                                                    {/* Overlay Grid for Tooltips, Dots, and X-labels */}
                                                                    <div className="absolute inset-0 flex z-20">
                                                                        {points.map((p, i) => {
                                                                            const isFirst = i === 0;
                                                                            const isLast = i === dataLen - 1;
                                                                            let tooltipClass = "left-1/2 -translate-x-1/2";
                                                                            let arrowClass = "left-1/2 -translate-x-1/2";
                                                                            
                                                                            if (isFirst) {
                                                                                tooltipClass = "left-1/2 -translate-x-3";
                                                                                arrowClass = "left-3";
                                                                            } else if (isLast) {
                                                                                tooltipClass = "right-1/2 translate-x-3";
                                                                                arrowClass = "right-3";
                                                                            }

                                                                            return (
                                                                                /* hover:z-50 brings the hovered point to the very front */
                                                                                <div
                                                                                    key={`hover-${i}`}
                                                                                    onClick={() => handleOpenCitationDetailModal(p)}
                                                                                    className="flex-1 relative group cursor-pointer h-full flex justify-center hover:z-50"
                                                                                >
                                                                                    
                                                                                    {/* Ghost Hover Highlight Area */}
                                                                                    <div className="absolute inset-y-0 w-[80%] max-w-[32px] z-0 bg-red-500/0 group-hover:bg-red-500/10 transition-colors rounded-sm"></div>
                                                                                    
                                                                                    {/* Dot and Tooltip Anchor */}
                                                                                    <div 
                                                                                        className="absolute z-20 flex justify-center items-center"
                                                                                        style={{ top: `${p.y}%`, transform: 'translateY(-50%)' }}
                                                                                    >
                                                                                        {/* Data Dot */}
                                                                                        <div className={`w-2.5 h-2.5 bg-white border-[2px] border-red-600 rounded-full transition-transform group-hover:scale-[1.4] shadow-sm ${p.copies === 0 ? 'opacity-30 group-hover:opacity-100' : 'opacity-100'}`} />
                                                                                        
                                                                                        {/* Tooltip Popup */}
                                                                                        <div className={`absolute bottom-full mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none w-max ${tooltipClass}`}>
                                                                                            <div className="bg-gray-800 text-white text-[10px] px-3 py-1.5 rounded shadow-lg whitespace-nowrap text-center leading-tight border border-gray-700">
                                                                                                <div className="font-semibold text-gray-200">{p.tooltipRange}:</div>
                                                                                                <div>{p.copies} copies</div>
                                                                                            </div>
                                                                                            <div className={`absolute -bottom-[4px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800 ${arrowClass}`}></div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* X-Axis Label */}
                                                                                    <div className="absolute -bottom-7 text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap text-center">
                                                                                        {p.displayLabel}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="h-8 w-full"></div>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        ) : (
                                            <div className="flex flex-1 items-center justify-center min-h-[120px] bg-red-50 rounded-lg border border-dashed border-red-200 mt-2">
                                                <p className="text-sm text-red-500 italic">No citation copies recorded yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div> 
                    )}
                    

                    {/* ----- FEEDBACK MANAGER TAB ----- */}
                    {activeTab === 'feedback' && (
                        <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-[1600px] mx-auto w-full mt-4">
                            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-none">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800">CSM Feedback</h2>
                                        <p className="text-sm text-gray-500">Manage client satisfaction responses</p>
                                    </div>
                                
                                    {/* Row 2: Export and Filters */}
                                    <div className="flex gap-3 items-center">
                                        {/* Export Dropdown Button */}
                                        <div className="relative" ref={feedbackExportDropdownRef}>
                                            <button
                                                onClick={() => setShowFeedbackExportDropdown(!showFeedbackExportDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-[#1E74BC] rounded-md bg-white text-[#1E74BC] hover:bg-blue-50 text-xs font-bold transition-colors shadow-sm"
                                                title="Export filtered feedback"
                                            >
                                                <Download size={14} />
                                                <span>Export Data</span>
                                                <ChevronDown size={14} />
                                            </button>

                                            {showFeedbackExportDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[180px]">
                                                    <button
                                                        onClick={() => {
                                                            handleFeedbackExportCSV();
                                                            setShowFeedbackExportDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 first:rounded-t-lg transition-colors"
                                                    >
                                                        Export as CSV
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleFeedbackExportPDF();
                                                            setShowFeedbackExportDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 last:rounded-b-lg transition-colors"
                                                    >
                                                        Export as PDF
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Date Filter Dropdown */}
                                        <div className="relative" ref={feedbackDateDropdownRef}>
                                            <button
                                                onClick={() => setShowFeedbackDateDropdown(!showFeedbackDateDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-gray-400 rounded-md bg-white text-gray-650 hover:bg-gray-100 text-xs font-medium"
                                            >
                                                <Calendar size={14} />
                                                <span>
                                                    {feedbackDateFilterType === 'All' && 'All dates'}
                                                    {feedbackDateFilterType === 'Year' && `Year ${feedbackSelectedYear}`}
                                                    {feedbackDateFilterType === 'Last 7 days' && 'Last 7 days'}
                                                    {feedbackDateFilterType === 'Month' && `${new Date(0, feedbackSelectedMonth-1).toLocaleString('default', { month: 'long' })} ${feedbackSelectedMonthYear}`}
                                                    {feedbackDateFilterType === 'Custom range' && 'Custom range'}
                                                </span>
                                                <ChevronDown size={14} />
                                            </button>

                                            {showFeedbackDateDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[260px] p-3">
                                                    {/* Filter type options */}
                                                    {feedbackDateFilterOptions.map(opt => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => {
                                                                setFeedbackDateFilterType(opt);
                                                                if (opt === 'Last 7 days') {
                                                                    setShowFeedbackDateDropdown(false);
                                                                }
                                                                if (opt !== 'Custom range') {
                                                                    setFeedbackCustomFrom('');
                                                                    setFeedbackCustomTo('');
                                                                }
                                                            }}
                                                            className={`block w-full text-left px-3 py-2 text-xs rounded-md ${
                                                                feedbackDateFilterType === opt
                                                                    ? 'bg-blue-50 text-blue-600 font-bold'
                                                                    : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}

                                                    {/* Year picker */}
                                                    {feedbackDateFilterType === 'Year' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                Select year
                                                            </label>
                                                            <select
                                                                aria-label="Select year for feedback filter"
                                                                value={feedbackSelectedYear}
                                                                onChange={(e) => setFeedbackSelectedYear(parseInt(e.target.value))}
                                                                className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                            >
                                                                {yearOptions.map(year => (
                                                                    <option key={year} value={year}>{year}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => setShowFeedbackDateDropdown(false)}
                                                                className="w-full mt-3 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Month picker */}
                                                    {feedbackDateFilterType === 'Month' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <div className="flex flex-col gap-2">
                                                                <div>
                                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                        Month
                                                                    </label>
                                                                    <select
                                                                        aria-label="Select month for feedback filter"
                                                                        value={feedbackSelectedMonth}
                                                                        onChange={(e) => setFeedbackSelectedMonth(parseInt(e.target.value))}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                    >
                                                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                                            <option key={month} value={month}>
                                                                                {new Date(0, month-1).toLocaleString('default', { month: 'long' })}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                        Year
                                                                    </label>
                                                                    <select
                                                                        aria-label="Select year for feedback month filter"
                                                                        value={feedbackSelectedMonthYear}
                                                                        onChange={(e) => setFeedbackSelectedMonthYear(parseInt(e.target.value))}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                    >
                                                                        {yearOptions.map(year => (
                                                                            <option key={year} value={year}>{year}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowFeedbackDateDropdown(false)}
                                                                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                                >
                                                                    Apply
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Custom range picker */}
                                                    {feedbackDateFilterType === 'Custom range' && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                                            <div className="flex flex-col gap-2">
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500 mb-1 block">From</span>
                                                                    <input
                                                                        type="date"
                                                                        value={feedbackCustomFrom}
                                                                        onChange={(e) => setFeedbackCustomFrom(e.target.value)}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] text-gray-500 mb-1 block">To</span>
                                                                    <input
                                                                        type="date"
                                                                        value={feedbackCustomTo}
                                                                        onChange={(e) => setFeedbackCustomTo(e.target.value)}
                                                                        className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        if (feedbackCustomFrom && feedbackCustomTo) {
                                                                            setShowFeedbackDateDropdown(false);
                                                                        } else {
                                                                            showToast('Select both dates', 'error');
                                                                        }
                                                                    }}
                                                                    className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                                >
                                                                    Apply Range
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Clear Filter button (disabled when filter type is 'All') */}
                                                    <div className="mt-3 pt-2 border-t border-gray-100">
                                                        <button
                                                            onClick={() => {
                                                                setFeedbackDateFilterType('All');
                                                                setFeedbackSelectedYear(new Date().getFullYear());
                                                                setFeedbackSelectedMonth(new Date().getMonth() + 1);
                                                                setFeedbackSelectedMonthYear(new Date().getFullYear());
                                                                setFeedbackCustomFrom('');
                                                                setFeedbackCustomTo('');
                                                                setShowFeedbackDateDropdown(false);
                                                            }}
                                                            disabled={feedbackDateFilterType === 'All'}
                                                            className={`w-full text-xs py-1.5 rounded border transition-colors ${
                                                                feedbackDateFilterType === 'All'
                                                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-red-600'
                                                            }`}
                                                        >
                                                            Clear Filter
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Client Type filter dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowClientTypeDropdown(!showClientTypeDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-gray-400 rounded-md bg-white text-gray-650 hover:bg-gray-100 text-xs font-medium"
                                            >
                                                <span>
                                                    {feedbackCategoryFilter === 'All' ? 'All Client Types' : feedbackCategoryFilter}
                                                </span>
                                                <ChevronDown size={14} className={`transition-transform ${showClientTypeDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {showClientTypeDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[160px] p-1">
                                                    {[
                                                        { value: 'All', label: 'All Client Types' },
                                                        ...clientTypeFilterOptions.map(option => ({ value: option, label: option }))
                                                    ].map(option => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => {
                                                                setFeedbackCategoryFilter(option.value);
                                                                setShowClientTypeDropdown(false);
                                                            }}
                                                            className={`block w-full text-left px-3 py-2 text-xs rounded-md ${
                                                                feedbackCategoryFilter === option.value
                                                                    ? 'bg-blue-50 text-blue-600 font-bold'
                                                                    : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status filter dropdown */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                                className="flex items-center space-x-2 px-3 py-1.5 border border-gray-400 rounded-md bg-white text-gray-650 hover:bg-gray-100 text-xs font-medium"
                                            >
                                                <span>
                                                    {feedbackStatusFilter === 'All' ? 'All Status' : feedbackStatusFilter}
                                                </span>
                                                <ChevronDown size={14} className={`transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {showStatusDropdown && (
                                                <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[140px] p-1">
                                                    {[
                                                        { value: 'All', label: 'All Status' },
                                                        { value: 'Pending', label: 'Pending' },
                                                        { value: 'Reviewed', label: 'Reviewed' },
                                                        { value: 'Resolved', label: 'Resolved' }
                                                    ].map(option => (
                                                        <button
                                                            key={option.value}
                                                            onClick={() => {
                                                                setFeedbackStatusFilter(option.value);
                                                                setShowStatusDropdown(false);
                                                            }}
                                                            className={`block w-full text-left px-3 py-2 text-xs rounded-md ${
                                                                feedbackStatusFilter === option.value
                                                                    ? 'bg-blue-50 text-blue-600 font-bold'
                                                                    : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Region</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Feedback Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Comment</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {feedbacks.length === 0 ? (
                                            <tr><td colSpan="8" className="px-6 py-10 text-center text-gray-500 text-sm">No feedback records found.</td></tr>
                                        ) : (
                                            (() => {
                                                const filtered = getFilteredFeedbacks();
                                                
                                                if (filtered.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan="8" className="px-6 py-10 text-center text-gray-500 text-sm">
                                                                No records match your filter.
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                                
                                                // Calculate pagination
                                                const totalPages = Math.ceil(filtered.length / feedbackItemsPerPage);
                                                const startIndex = (currentFeedbackPage - 1) * feedbackItemsPerPage;
                                                const endIndex = startIndex + feedbackItemsPerPage;
                                                const paginatedFeedback = filtered.slice(startIndex, endIndex);
                                                
                                                return paginatedFeedback.map((fb) => (
                                                    <tr key={fb.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => handleFeedbackClick(fb)} title="View details">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                                            {new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center text-yellow-500">
                                                                <span className="font-bold mr-1 text-gray-700">{fb.litpath_rating}</span>
                                                                <Star size={14} fill="currentColor" />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100 font-medium">
                                                                {getDisplayClientType(fb)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                            {fb.region || '—'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                            {fb.admin_category || fb.category || '—'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                            {fb.message_comment || <span className="text-gray-400 italic">No comment</span>}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                                ${fb.status === 'Resolved' ? 'bg-green-100 text-green-800' : ''}
                                                                ${fb.status === 'Reviewed' ? 'bg-blue-100 text-blue-800' : ''}
                                                                ${fb.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                                                            `}>
                                                                {fb.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ));
                                            })()
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {feedbacks.length > 0 && (() => {
                                const filtered = getFilteredFeedbacks();
                                const totalPages = Math.ceil(filtered.length / feedbackItemsPerPage);
                                
                                return (
                                    <div className="flex items-center justify-center mt-4 px-6 py-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={() => setCurrentFeedbackPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentFeedbackPage === 1}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                                                    currentFeedbackPage === 1
                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                                                }`}
                                            >
                                                <ChevronLeft size={16} /> Previous
                                            </button>
                                            
                                            <div className="text-sm text-gray-600 px-3 py-1.5 font-semibold">
                                                {Math.min((currentFeedbackPage - 1) * feedbackItemsPerPage + 1, filtered.length)}-{Math.min(currentFeedbackPage * feedbackItemsPerPage, filtered.length)} of {filtered.length}
                                            </div>
                                            
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentFeedbackPage(page)}
                                                        className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                                                            currentFeedbackPage === page
                                                                ? 'bg-blue-600 text-white border border-blue-600'
                                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                ))}
                                            </div>
                                            
                                            <button
                                                onClick={() => setCurrentFeedbackPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentFeedbackPage === totalPages}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                                                    currentFeedbackPage === totalPages
                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                                                }`}
                                            >
                                                Next <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}


                    {/* ----- MATERIAL RATINGS TAB ----- */}
                    {activeTab === 'ratings' && (
                        <div className="h-full flex flex-col gap-2 max-w-[1600px] mx-auto w-full overflow-y-auto pb-8 pr-2">

                            {/* 1. Header & Filter Section */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Content Relevance & Quality</h2>
                                    <p className="text-sm text-gray-500">Monitor user satisfaction and identify materials for archiving</p>
                                </div>
                                

                                {/* Row 2: Export and Filters */}
                                <div className="flex gap-2 items-center">
                                    {/* Export Dropdown Button */}
                                    <div className="relative" ref={ratingsExportDropdownRef}>
                                        <button
                                            onClick={() => setShowRatingsExportDropdown(!showRatingsExportDropdown)}
                                            className="flex items-center space-x-2 px-3 py-1.5 border border-[#1E74BC] rounded-md bg-white text-[#1E74BC] hover:bg-blue-50 text-xs font-bold transition-colors shadow-sm"
                                            title="Export filtered ratings"
                                        >
                                            <Download size={14} />
                                            <span>Export Data</span>
                                            <ChevronDown size={14} />
                                        </button>

                                        {showRatingsExportDropdown && (
                                            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-30 min-w-[180px]">
                                                <button
                                                    onClick={() => {
                                                        handleRatingsExportCSV();
                                                        setShowRatingsExportDropdown(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 first:rounded-t-lg transition-colors"
                                                >
                                                    Export as CSV
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleRatingsExportPDF();
                                                        setShowRatingsExportDropdown(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 last:rounded-b-lg transition-colors"
                                                >
                                                    Export as PDF
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                
                                    {/* Date Filter Dropdown */}
                                    <div className="relative" ref={ratingsDateDropdownRef}>
                                        <button
                                            onClick={() => setShowRatingsDateDropdown(!showRatingsDateDropdown)}
                                            className="flex items-center space-x-2 px-3 py-1.5 border border-gray-400 rounded-md bg-white text-gray-650 hover:bg-gray-100 text-xs font-medium"
                                        >
                                            <Calendar size={14} />
                                            <span>
                                                {ratingsDateFilterType === 'All' && 'All Time'}
                                                {ratingsDateFilterType === 'Year' && `Year ${ratingsSelectedYear}`}
                                                {ratingsDateFilterType === 'Last 7 days' && 'Last 7 Days'}
                                                {ratingsDateFilterType === 'Month' && `${new Date(0, ratingsSelectedMonth - 1).toLocaleString('default', { month: 'short' })} ${ratingsSelectedMonthYear}`}
                                                {ratingsDateFilterType === 'Custom range' && 'Custom Range'}
                                            </span>
                                            <ChevronDown size={14} />
                                        </button>

                                        {showRatingsDateDropdown && (
                                            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[260px] p-3 animate-fadeIn">
                                                {/* Filter type options */}
                                                {ratingsDateFilterOptions.map(opt => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => {
                                                            setRatingsDateFilterType(opt);
                                                            if (opt === 'Last 7 days') setShowRatingsDateDropdown(false);
                                                            if (opt !== 'Custom range') {
                                                                setRatingsCustomFrom('');
                                                                setRatingsCustomTo('');
                                                            }
                                                        }}
                                                        className={`block w-full text-left px-3 py-2 text-sm rounded-lg mb-1 ${
                                                            ratingsDateFilterType === opt
                                                                ? 'bg-blue-50 text-blue-600 font-bold'
                                                                : 'hover:bg-gray-50 text-gray-600'
                                                        }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}

                                                {/* Year picker */}
                                                {ratingsDateFilterType === 'Year' && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                            Select year
                                                        </label>
                                                        <select
                                                            aria-label="Select year for ratings filter"
                                                            value={ratingsSelectedYear}
                                                            onChange={(e) => setRatingsSelectedYear(parseInt(e.target.value))}
                                                            className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                        >
                                                            {yearOptions.map(year => (
                                                                <option key={year} value={year}>{year}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => setShowRatingsDateDropdown(false)}
                                                            className="w-full mt-3 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Month picker */}
                                                {ratingsDateFilterType === 'Month' && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <div className="flex flex-col gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                    Month
                                                                </label>
                                                                <select
                                                                    aria-label="Select month for ratings filter"
                                                                    value={ratingsSelectedMonth}
                                                                    onChange={(e) => setRatingsSelectedMonth(parseInt(e.target.value))}
                                                                    className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                >
                                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                                                        <option key={month} value={month}>
                                                                            {new Date(0, month - 1).toLocaleString('default', { month: 'long' })}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                                                                    Year
                                                                </label>
                                                                <select
                                                                    aria-label="Select year for ratings month filter"
                                                                    value={ratingsSelectedMonthYear}
                                                                    onChange={(e) => setRatingsSelectedMonthYear(parseInt(e.target.value))}
                                                                    className="w-full text-xs border border-gray-300 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500"
                                                                >
                                                                    {yearOptions.map(year => (
                                                                        <option key={year} value={year}>{year}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <button
                                                                onClick={() => setShowRatingsDateDropdown(false)}
                                                                className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Custom range picker */}
                                                {ratingsDateFilterType === 'Custom range' && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <div className="flex flex-col gap-2">
                                                            <div>
                                                                <span className="text-[10px] text-gray-500 mb-1 block">From</span>
                                                                <input
                                                                    type="date"
                                                                    value={ratingsCustomFrom}
                                                                    onChange={(e) => setRatingsCustomFrom(e.target.value)}
                                                                    className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-gray-500 mb-1 block">To</span>
                                                                <input
                                                                    type="date"
                                                                    value={ratingsCustomTo}
                                                                    onChange={(e) => setRatingsCustomTo(e.target.value)}
                                                                    className="w-full text-xs border border-gray-300 rounded-md p-1.5"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    if (ratingsCustomFrom && ratingsCustomTo) {
                                                                        setShowRatingsDateDropdown(false);
                                                                    } else {
                                                                        showToast('Select both dates', 'error');
                                                                    }
                                                                }}
                                                                className="w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition-colors font-medium"
                                                            >
                                                                Apply Range
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Clear Filter button (resets to All) */}
                                                <div className="mt-3 pt-2 border-t border-gray-100">
                                                    <button
                                                        onClick={() => {
                                                            setRatingsDateFilterType('All');
                                                            setRatingsSelectedYear(new Date().getFullYear());
                                                            setRatingsSelectedMonth(new Date().getMonth() + 1);
                                                            setRatingsSelectedMonthYear(new Date().getFullYear());
                                                            setRatingsCustomFrom('');
                                                            setRatingsCustomTo('');
                                                            setShowRatingsDateDropdown(false);
                                                        }}
                                                        disabled={ratingsDateFilterType === 'All'}
                                                        className={`w-full text-xs py-1.5 rounded border transition-colors ${
                                                            ratingsDateFilterType === 'All'
                                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-red-600'
                                                        }`}
                                                    >
                                                        Clear Filter
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                                
                                {/* Total Votes */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={handleOpenVotesModal}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleOpenVotesModal();
                                        }
                                    }}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                                >
                                    <div className="flex items-center gap-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <MessageSquare size={18} className="text-blue-600" /> Total Votes
                                        </p>
                                        <div className="relative group">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                    Number of relevance votes (helpful / not relevant) in the selected period.
                                                </div>
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(currentVotes)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Total number of votes for both helpful and not relevant</p>
                                    {voteTrend !== null && (
                                        <div className="flex items-center text-xs text-gray-500 mt-1">
                                            <span className={`font-bold mr-1 ${voteTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {voteTrend > 0 ? '+' : ''}{voteTrend}
                                            </span>
                                            from {trendLabel}
                                        </div>
                                    )}
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                                        Click to view
                                    </div>
                                </div>

                                {/* Relevance Score */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={handleOpenRelevanceScoreModal}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleOpenRelevanceScoreModal();
                                        }
                                    }}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                                >
                                    <div className="flex items-center gap-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <Star size={18} className="text-yellow-500" /> Relevance Score
                                        </p>
                                        <div className="relative group">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                    Percentage of votes marked as helpful.
                                                </div>
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <p className="text-2xl font-bold text-gray-900">{getRelevanceScore()}%</p>
                                        <span className="text-xs text-gray-400">helpful vote rate</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {helpfulCount} relevant material vote{helpfulCount !== 1 ? 's' : ''}
                                    </p>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1.5 rounded-full" style={{ width: `${getRelevanceScore()}%` }}></div>
                                    </div>
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                                        Click to view
                                    </div>
                                </div>

                                {/* Helpful */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={handleOpenHelpfulModal}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleOpenHelpfulModal();
                                        }
                                    }}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group relative"
                                >
                                    <div className="flex items-center gap-1">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <ThumbsUp size={18} className="text-green-600" /> Helpful
                                        </p>
                                        <div className="relative group">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                    Same material voted as relevant.
                                                </div>
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-2xl font-bold text-green-600 mt-2">
                                        {helpfulCount}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Same material voted as relevant</p>
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                                        Click to view
                                    </div>
                                </div>

                                {/* Dormant Materials */}
                                <div 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenDormantMaterialsModal();
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleOpenDormantMaterialsModal();
                                        }
                                    }}

                                    title="Open dormant materials KPI details"
                                    className="group relative bg-white p-4 rounded-lg shadow-sm border border-blue-100 cursor-pointer hover:shadow-md hover:border-[#1E74BC] hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-[#1E74BC] focus:ring-offset-2 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                            <LogOut size={18} className="text-blue-600" /> Dormant Materials
                                        </p>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#1E74BC] border border-blue-100 group-hover:bg-white">
                                            View KPI
                                            <ChevronRight size={12} />
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 mt-2">
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{formatNumber(dormantCount)}</p>
                                            <p className="text-xs text-gray-400 mt-1">Dormant (30+ days)</p>
                                        </div>
                                        <div className="relative group pointer-events-none">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col items-end z-50 pointer-events-none w-72 max-w-[min(18rem,calc(100vw-2rem))]">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center leading-snug whitespace-normal">
                                                    Materials not accessed for 30+ days or never accessed (and uploaded 30+ days ago). Click to see details.
                                                </div>
                                                <div className="mr-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(dormantCount)}</p>
                                    <p className="text-xs text-gray-400 mt-1">Dormant (30+ days)</p>
                                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                                        Click to view
                                    </div>
                                </div>
                            </div>

                            {/* Top Rated & Least Accessed Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">

                                {/* 1. Top Rated Materials */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={handleOpenTopRatedModal}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleOpenTopRatedModal();
                                        }
                                    }}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col h-full cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
                                >
                                    <div className="flex items-center gap-1.5 mb-2 border-b border-gray-100 pb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                                <ThumbsUp size={16} className="text-blue-600" />
                                                Top Rated Materials
                                            </h3>
                                            <p className="text-sm text-gray-500 italic mt-1">Click to view full ranked list</p>
                                        </div>
                                        <div className="relative group">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-64">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                    Materials ranked by a weighted score that balances positive votes and total votes to avoid "one‑hit wonders". Higher confidence materials appear first.
                                                </div>
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-1">
                                        {getTopMaterials(filteredRatings).length > 0 ? (
                                            getTopMaterials(filteredRatings).map((item, index) => {
                                                const maxCount = getTopMaterials(filteredRatings)[0].count;
                                                return (
                                                    <div
                                                        key={index}
                                                        className={`flex items-start gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-100 cursor-pointer ${
                                                            selectedMaterialFilter === item.title ? 'bg-green-100 border-green-300' : ''
                                                        }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                                            index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                                            index === 1 ? 'bg-gray-100 text-gray-600' : 
                                                            index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white border border-gray-200 text-gray-500'
                                                        }`}>
                                                            {index + 1}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-gray-800 truncate" title={item.title}>
                                                                {item.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-blue-500 rounded-full" 
                                                                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex-shrink-0 text-right">
                                                            <span className="text-xs font-bold mr-1" >{item.count}</span>
                                                            <span className="text-[10px] text-gray-400 block">likes</span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[150px]">
                                                <Star size={24} className="mb-2 opacity-20" />
                                                <p className="text-xs">No positive ratings yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Least Viewed Materials */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col h-full">
                                    <div className="flex items-center gap-1.5 mb-2 border-b border-gray-100 pb-3">
                                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            <TrendingUp size={16} className="text-orange-500" />
                                            Least Viewed Materials
                                        </h3>
                                        <div className="relative group">
                                            <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-64">
                                                <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                    Materials with the lowest number of views. Dormant materials are not accessed for 30+ days. Recently uploaded materials are shown separately.
                                                </div>
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto max-h-[450px] pr-1">
                                        {leastAccessedMaterials.length > 0 ? (
                                            <div className="space-y-2">
                                                {leastAccessedMaterials.slice(0, 8).map((item, index) => (
                                                    <div key={index} className="flex items-start justify-between p-2 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-100 group">
                                                        <div className="flex items-start gap-2 overflow-hidden flex-1">
                                                            <div className="flex-shrink-0 bg-orange-100 text-orange-600 p-1.5 rounded-md mt-0.5">
                                                                <BookOpen size={14} className="text-orange-600" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-medium text-gray-700 truncate group-hover:text-gray-900" title={item.title}>
                                                                    {item.title}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                                    <Calendar size={10} />
                                                                    Uploaded: {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                                    <Clock size={10} />
                                                                    Last accessed: {item.last_accessed ? new Date(item.last_accessed).toLocaleDateString() : 'Never'}
                                                                </p>
                                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                    {item.is_recently_uploaded && !item.is_dormant && (
                                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-semibold">
                                                                            Recently Uploaded
                                                                        </span>
                                                                    )}
                                                                    {item.is_dormant && (
                                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">
                                                                            Dormant
                                                                        </span>
                                                                    )}
                                                                    
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 text-right pl-2 mt-0.5">
                                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200 inline-block group-hover:hidden">
                                                                {item.view_count || 0} views
                                                            </span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRequestArchive(item); }}
                                                                title="Archive material"
                                                                className="hidden group-hover:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-semibold"
                                                            >
                                                                <Archive size={14} />
                                                                Archive
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[150px]">
                                                <BookOpen size={24} className="mb-2 opacity-20" />
                                                <p className="text-xs">No low-traffic materials found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Column 3: Rating Distribution (top) + placeholder (bottom) */}
                                <div className="flex flex-col gap-2 h-full min-h-[300px]">

                                    {/* Top half: Rating Distribution */}
                                    <div ref={ratingDistributionChartRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                <BarChart3 size={16} className="text-blue-600" />
                                                Rating Distribution
                                            </h3>
                                            <div className="relative group">
                                                <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-64">
                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center">
                                                        Breakdown of all relevance votes (helpful vs. not relevant) within the selected date range.
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                </div>
                                            </div>
                                        </div>
                                        {filteredRatings.length > 0 ? (
                                            <div className="flex flex-col md:flex-row items-center gap-4">
                                                {/* Donut with centered total */}
                                                <div className="relative w-32 h-32 flex-shrink-0">
                                                    <div
                                                        className="w-full h-full rounded-full transition"
                                                        style={{
                                                            background: `conic-gradient(#22c55e 0% ${helpfulPercent}%, #ef4444 ${helpfulPercent}% 100%)`,
                                                            mask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                            filter: hoveredSegment === 'helpful'
                                                                ? 'brightness(1.04) drop-shadow(0 0 14px rgba(34,197,94,0.18))'
                                                                : hoveredSegment === 'notRelevant'
                                                                    ? 'brightness(1.04) drop-shadow(0 0 14px rgba(239,68,68,0.18))'
                                                                    : 'none',
                                                            transform: hoveredSegment ? 'scale(1.02)' : 'none'
                                                        }}
                                                    />
                                                    {hoveredSegment && (
                                                        <div
                                                            className="absolute inset-0 rounded-full pointer-events-none"
                                                            style={{
                                                                background: hoveredSegment === 'helpful'
                                                                    ? `conic-gradient(rgba(34,197,94,0.28) 0% ${helpfulPercent}%, transparent ${helpfulPercent}% 100%)`
                                                                    : `conic-gradient(transparent 0% ${helpfulPercent}%, rgba(239,68,68,0.28) ${helpfulPercent}% 100%)`,
                                                                mask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                                WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 50%, black 51%)',
                                                                boxShadow: hoveredSegment === 'helpful'
                                                                    ? '0 0 0 2px rgba(34,197,94,0.12) inset'
                                                                    : '0 0 0 2px rgba(239,68,68,0.12) inset'
                                                            }}
                                                        />
                                                    )}
                                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32" aria-hidden="true">
                                                        {helpfulPercent > 0 && (
                                                            <path
                                                                d={getDonutSectorPath(0, helpfulAngle)}
                                                                fill="transparent"
                                                                stroke="transparent"
                                                                pointerEvents="all"
                                                                onMouseEnter={() => setHoveredSegment('helpful')}
                                                                onMouseLeave={() => setHoveredSegment(null)}
                                                                onClick={handleOpenHelpfulModal}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        )}
                                                        {helpfulPercent < 100 && (
                                                            <path
                                                                d={getDonutSectorPath(helpfulAngle, 360)}
                                                                fill="transparent"
                                                                stroke="transparent"
                                                                pointerEvents="all"
                                                                onMouseEnter={() => setHoveredSegment('notRelevant')}
                                                                onMouseLeave={() => setHoveredSegment(null)}
                                                                onClick={handleOpenNotRelevantModal}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        )}
                                                    </svg>
                                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 pointer-events-none">
                                                        {filteredRatings.length} total
                                                    </div>
                                                </div>
                                                {/* Legend */}
                                                <div className="flex-1 space-y-1 px-6">
                                                    <button
                                                        type="button"
                                                        className={`flex items-center gap-2 text-[10px] w-full rounded-lg px-2 py-2 transition ${hoveredSegment === 'helpful' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                                                        onMouseEnter={() => setHoveredSegment('helpful')}
                                                        onMouseLeave={() => setHoveredSegment(null)}
                                                        onClick={handleOpenHelpfulModal}
                                                        aria-label="Show helpful materials"
                                                    >
                                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></span>
                                                        <span className="flex-1 text-left">Helpful</span>
                                                        <span className="font-semibold text-gray-700">{helpfulCount} ({helpfulPercent.toFixed(1)}%)</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`flex items-center gap-2 text-[10px] w-full rounded-lg px-2 py-2 transition ${hoveredSegment === 'notRelevant' ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                                                        onMouseEnter={() => setHoveredSegment('notRelevant')}
                                                        onMouseLeave={() => setHoveredSegment(null)}
                                                        onClick={handleOpenNotRelevantModal}
                                                        aria-label="Show not relevant materials"
                                                    >
                                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>
                                                        <span className="flex-1 text-left">Not relevant</span>
                                                        <span className="font-semibold text-gray-700">{notRelevantCount} {(100 - helpfulPercent).toFixed(1)}%</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                                No ratings yet
                                            </div>
                                        )}
                                    </div>

                                    {/* Rating Trend Chart */}
                                    <div ref={ratingTrendChartRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1">
                                        <div className="flex items-center justify-between mb-3 flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-blue-600" /> Rating Trend
                                                </h3>
                                                <div className="relative group">
                                                    <Info size={14} className="text-gray-400 cursor-help hover:text-gray-600" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none w-48">
                                                        <div className="bg-gray-800 text-white text-[10px] px-3 py-2 rounded shadow-lg text-center font-normal normal-case tracking-normal">
                                                            Average relevance score over time, based on your current date filter.
                                                        </div>
                                                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-500 italic">
                                                {ratingsDateFilterType === 'Year' && `(Monthly averages for ${ratingsSelectedYear})`}
                                                {ratingsDateFilterType === 'Month' && `(Weekly averages for ${new Date(0, ratingsSelectedMonth-1).toLocaleString('default', { month: 'long' })} ${ratingsSelectedMonthYear})`}
                                                {ratingsDateFilterType === 'Last 7 days' && '(Daily averages for the last 7 days)'}
                                                {ratingsDateFilterType === 'Custom range' && ratingsCustomFrom && ratingsCustomTo &&
                                                    `(Daily averages from ${new Date(ratingsCustomFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${new Date(ratingsCustomTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
                                                }
                                                {ratingsDateFilterType === 'All' && '(Monthly averages over all time)'}
                                            </span>
                                        </div>

                                        {(() => {
                                            const trendData = getRatingTrendData();
                                            const totalHelpful = filteredRatings.filter(r => r.relevant === true).length;
                                            const totalVotes = filteredRatings.length;
                                            const overallAvg = totalVotes > 0 ? (totalHelpful / totalVotes) * 100 : 0;

                                            if (trendData.length === 0) {
                                                return (
                                                    <div className="flex flex-1 items-center justify-center min-h-[120px] bg-blue-50 rounded-lg border border-dashed border-blue-200 mt-2">
                                                        <p className="text-sm text-blue-500 italic">No rating data available</p>
                                                    </div>
                                                );
                                            }

                                            const maxAvg = 100; // percentage scale
                                            const dataLen = trendData.length;

                                            // Helper to format Y-axis ticks (0–100%)
                                            const tick = (mult) => `${Math.round(maxAvg * mult)}%`;

                                            // Build points for the line chart (SVG coordinates)
                                            const points = trendData.map((item, i) => {
                                                const x = ((i + 0.5) / dataLen) * 100;
                                                const y = 100 - item.avgScore; // invert for SVG (0 at top, 100 at bottom)
                                                return { x, y, ...item };
                                            });

                                            const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                            const areaPath = `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

                                            return (
                                                <>
                                                    {/* Overall average score displayed prominently */}
                                                    <p className="text-2xl font-bold text-gray-900">{overallAvg.toFixed(1)}%</p>
                                                    <p className="text-xs text-gray-500 mb-2">average relevance in this period ({totalVotes} votes)</p>

                                                    <div className="flex w-full mt-6 h-[150px] relative">
                                                        {/* Y-Axis Labels */}
                                                        <div className="relative w-10 shrink-0">
                                                            <span className="absolute right-2 top-0 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(1)}</span>
                                                            <span className="absolute right-2 top-[25%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.75)}</span>
                                                            <span className="absolute right-2 top-[50%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.5)}</span>
                                                            <span className="absolute right-2 top-[75%] -translate-y-1/2 text-[10px] text-gray-400 font-medium">{tick(0.25)}</span>
                                                            <span className="absolute right-2 bottom-0 translate-y-1/2 text-[10px] text-gray-400 font-medium">0%</span>
                                                        </div>

                                                        {/* Chart Area */}
                                                        <div className="flex-1 relative border-b-2 border-l-2 border-gray-200">
                                                            {/* Horizontal Grid Lines */}
                                                            <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 z-0"></div>
                                                            <div className="absolute inset-x-0 top-[25%] border-t border-dashed border-gray-200 z-0"></div>
                                                            <div className="absolute inset-x-0 top-[50%] border-t border-dashed border-gray-200 z-0"></div>
                                                            <div className="absolute inset-x-0 top-[75%] border-t border-dashed border-gray-200 z-0"></div>

                                                            {/* SVG for area and line */}
                                                            <div className="absolute inset-0 w-full h-full overflow-visible z-10">
                                                                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                                                    <defs>
                                                                        <linearGradient id="ratingGradient" x1="0" x2="0" y1="0" y2="1">
                                                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <path d={areaPath} fill="url(#ratingGradient)" />
                                                                    <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            </div>

                                                            {/* Overlay for tooltips, dots, and x‑axis labels */}
                                                            <div className="absolute inset-0 flex z-20">
                                                                {points.map((p, i) => {
                                                                    const isFirst = i === 0;
                                                                    const isLast = i === dataLen - 1;
                                                                    let tooltipClass = "left-1/2 -translate-x-1/2";
                                                                    let arrowClass = "left-1/2 -translate-x-1/2";

                                                                    if (isFirst) {
                                                                        tooltipClass = "left-1/2 -translate-x-3";
                                                                        arrowClass = "left-3";
                                                                    } else if (isLast) {
                                                                        tooltipClass = "right-1/2 translate-x-3";
                                                                        arrowClass = "right-3";
                                                                    }

                                                                    return (
                                                                        <div key={`hover-${i}`} className="flex-1 relative group cursor-pointer h-full flex justify-center hover:z-50">
                                                                            {/* Ghost hover highlight */}
                                                                            <div className="absolute inset-y-0 w-[80%] max-w-[32px] z-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors rounded-sm"></div>

                                                                            {/* Dot and tooltip anchor */}
                                                                            <div
                                                                                className="absolute z-20 flex justify-center items-center cursor-pointer"
                                                                                style={{ top: `${p.y}%`, transform: 'translateY(-50%)' }}
                                                                                onClick={() => handleOpenTrendDetailModal(p)}
                                                                            >
                                                                                <div className={`w-2.5 h-2.5 bg-white border-[2px] border-blue-600 rounded-full transition-transform group-hover:scale-[1.4] shadow-sm ${p.avgScore === 0 ? 'opacity-30 group-hover:opacity-100' : 'opacity-100'}`} />

                                                                                {/* Tooltip */}
                                                                                <div className={`absolute bottom-full mb-2 hidden group-hover:flex flex-col z-50 pointer-events-none w-max ${tooltipClass}`}>
                                                                                    <div className="bg-gray-800 text-white text-[10px] px-3 py-1.5 rounded shadow-lg whitespace-nowrap text-center leading-tight border border-gray-700">
                                                                                        <div className="font-semibold text-gray-200">{p.tooltipRange}</div>
                                                                                        <div>{p.avgScore.toFixed(1)}% helpful ({p.helpful}/{p.count} votes)</div>
                                                                                    </div>
                                                                                    <div className={`absolute -bottom-[4px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-800 ${arrowClass}`}></div>
                                                                                </div>
                                                                            </div>

                                                                            {/* X-Axis Label */}
                                                                            <div className="absolute -bottom-7 text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap text-center">
                                                                                {p.displayLabel}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-8 w-full"></div> {/* spacer for x‑axis labels */}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Account Settings Modal */}
            {showAccountSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] text-white p-4">
                        <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Settings size={24} />
                            Account Settings
                        </h2>
                        <button
                            type="button"
                            title="Close account settings"
                            onClick={() => setShowAccountSettings(false)}
                            className="text-white hover:text-gray-200 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                        onClick={() => setSettingsTab('profile')}
                        className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                            settingsTab === 'profile'
                            ? 'text-[#1E74BC] border-b-2 border-[#1E74BC] bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                        >
                        <User size={16} />
                        Edit Profile
                        </button>
                        <button
                        onClick={() => setSettingsTab('password')}
                        className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                            settingsTab === 'password'
                            ? 'text-[#1E74BC] border-b-2 border-[#1E74BC] bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                        >
                        <Key size={16} />
                        Change Password
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {settingsTab === 'profile' && (
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black focus:outline-none"
                                required
                            />
                            </div>
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black focus:outline-none"
                                required
                            />
                            </div>
                            <button
                            type="submit"
                            disabled={settingsLoading}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                            {settingsLoading ? (
                                <>
                                <RefreshCw size={16} className="animate-spin" />
                                Saving...
                                </>
                            ) : (
                                <>
                                <User size={16} />
                                Save Changes
                                </>
                            )}
                            </button>
                        </form>
                        )}

                        {settingsTab === 'password' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            {/* Current Password */}
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black focus:outline-none pr-10"
                                required
                                />
                                <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            </div>

                            {/* New Password */}
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black focus:outline-none pr-10"
                                required
                                minLength={8}
                                />
                                <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            </div>

                            {/* Confirm New Password */}
                            <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black focus:outline-none pr-10"
                                required
                                minLength={8}
                                />
                                <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            </div>

                            {/* Password hint */}
                            <div className="mt-1">
                                <PasswordRequirements checks={passwordChecks} />
                            </div>

                            <button
                            type="submit"
                            disabled={settingsLoading}
                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                            {settingsLoading ? (
                                <>
                                <RefreshCw size={16} className="animate-spin" />
                                Updating...
                                </>
                            ) : (
                                <>
                                <Key size={16} />
                                Change Password
                                </>
                            )}
                            </button>
                        </form>
                        )}
                    </div>
                    </div>
                </div>
                )}
            </div>

            {/* Dormant Materials Modal */}
            {showDormantMaterialsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header with Export Buttons */}
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <LogOut size={24} className="text-blue-200" />
                                    Dormant Materials KPI
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    Detailed inactivity insights and export-ready thesis list
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDormantMaterialsExportExcel}
                                    className="bg-white text-[#1E74BC] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    Excel
                                </button>
                                <button
                                    onClick={handleDormantMaterialsExportPDF}
                                    className="bg-white text-[#1E74BC] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    PDF
                                </button>
                                <button
                                    title="Close dormant materials modal"
                                    onClick={() => setShowDormantMaterialsModal(false)}
                                    className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors ml-2"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {dormantMaterialsList.length > 0 && (() => {
                                const kpis = getDormantKpis();
                                const rows = getDormantExportRows();
                                const highRiskRows = rows.filter(row => row.daysInactive >= 90);
                                const zeroViewRows = rows.filter(row => row.views === 0);

                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="border border-blue-100 bg-blue-50 rounded-lg p-3 min-h-[112px]">
                                                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Dormant Theses</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(kpis.total)}</p>
                                                <p className="text-xs text-blue-700 mt-1">Inactive or never accessed</p>
                                            </div>
                                            <div className="border border-amber-100 bg-amber-50 rounded-lg p-3 min-h-[112px]">
                                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Avg. Inactive Days</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(kpis.averageInactiveDays)}</p>
                                                <p className="text-xs text-amber-700 mt-1">Longest: {formatNumber(kpis.longestInactiveDays)} days</p>
                                            </div>
                                            <div className="border border-red-100 bg-red-50 rounded-lg p-3 min-h-[112px]">
                                                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Zero-View Rate</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.zeroViewsPercent}%</p>
                                                <p className="text-xs text-red-700 mt-1">{formatNumber(kpis.zeroViews)} theses with no views</p>
                                            </div>
                                            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 min-h-[112px]">
                                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Avg. Views</p>
                                                <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.averageViews}</p>
                                                <p className="text-xs text-slate-600 mt-1">{formatNumber(kpis.totalViews)} total dormant views</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
                                            <div className="lg:col-span-2 border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-800">Dormant Thesis Inventory</h3>
                                                        <p className="text-xs text-gray-500">Includes inactivity reason, days inactive, views, and recommended action.</p>
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded px-2 py-1">
                                                        {rows.length} records
                                                    </span>
                                                </div>
                                                <div className="overflow-auto max-h-[430px]">
                                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                        <thead className="bg-white">
                                                            <tr>
                                                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Title</th>
                                                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Last Accessed</th>
                                                                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wide">Inactive</th>
                                                                <th className="px-3 py-2.5 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wide">Views</th>
                                                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-100">
                                                            {rows.map((row, index) => (
                                                                <tr key={`${row.file}-${index}`} className="hover:bg-blue-50/60">
                                                                    <td className="px-3 py-2.5 max-w-[320px]">
                                                                        <p className="font-semibold text-gray-900 line-clamp-2" title={row.title}>{row.title}</p>
                                                                        <p className="text-xs text-gray-500 mt-1">{row.year} | {row.reason}</p>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.lastAccessed}</td>
                                                                    <td className="px-3 py-2.5 text-right">
                                                                        <span className={`font-bold ${row.daysInactive >= 90 ? 'text-red-700' : 'text-amber-700'}`}>
                                                                            {formatNumber(row.daysInactive)} days
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-700">{formatNumber(row.views)}</td>
                                                                    <td className="px-3 py-2.5 text-gray-600">{row.action}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="border border-gray-200 rounded-lg p-4 bg-white h-full">
                                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                        <AlertCircle size={16} className="text-red-600" />
                                                        Attention Signals
                                                    </h3>
                                                    <div className="mt-4 space-y-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-600">90+ days inactive</span>
                                                            <span className="font-bold text-red-700">{formatNumber(highRiskRows.length)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-600">Zero views</span>
                                                            <span className="font-bold text-gray-900">{formatNumber(zeroViewRows.length)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-600">Previously accessed</span>
                                                            <span className="font-bold text-blue-700">{formatNumber(kpis.previouslyAccessed)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 h-full">
                                                    <h3 className="text-sm font-bold text-gray-800">Export Package</h3>
                                                    <div className="mt-4 space-y-3 text-sm">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-600">PDF report</span>
                                                            <span className="font-bold text-[#1E74BC]">KPI + list</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-600">Excel workbook</span>
                                                            <span className="font-bold text-[#1E74BC]">Shareable</span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 pt-1">
                                                            Includes inactivity days, view count, dormancy reason, and recommended action.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {dormantMaterialsList.length > 0 ? (
                                <div className="hidden">
                                    {dormantMaterialsList.map((material, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                                                        {material.title || 'Untitled'}
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
                                                        <div>
                                                            <span className="font-semibold text-gray-700">Uploaded:</span>
                                                            <p className="text-gray-600 mt-0.5">
                                                                {material.created_at 
                                                                    ? new Date(material.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                                                    : '—'
                                                                }
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-gray-700">Last Accessed:</span>
                                                            <p className="text-gray-600 mt-0.5">
                                                                {material.last_accessed
                                                                    ? new Date(material.last_accessed).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                                                    : 'Never'
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
                                                        Dormant
                                                    </span>
                                                    <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-bold">
                                                        {material.view_count || 0} views
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <BookOpen size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No dormant materials found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Helpful Materials Modal */}
            {showHelpfulModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ThumbsUp size={24} className="text-green-200" />
                                    Helpful Materials
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {helpfulRatings.length} helpful vote{helpfulRatings.length !== 1 ? 's' : ''} in the selected period
                                </p>
                            </div>
                            <button
                                title="Close helpful materials modal"
                                onClick={() => setShowHelpfulModal(false)}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {helpfulMaterialsByTitle.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Helpful Votes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {helpfulMaterialsByTitle.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{item.title}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <ThumbsUp size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No helpful materials found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Not Relevant Materials Modal */}
            {showNotRelevantModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ThumbsDown size={24} className="text-red-200" />
                                    Not Relevant Materials
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {notRelevantRatings.length} not relevant vote{notRelevantRatings.length !== 1 ? 's' : ''} in the selected period
                                </p>
                            </div>
                            <button
                                title="Close not relevant materials modal"
                                onClick={() => setShowNotRelevantModal(false)}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {notRelevantMaterialsByTitle.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Not Relevant Votes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {notRelevantMaterialsByTitle.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{item.title}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <ThumbsDown size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No not relevant materials found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Trend Detail Modal */}
            {showRatingTrendDetailModal && selectedTrendBucket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp size={24} className="text-blue-200" />
                                    {selectedTrendBucket.tooltipRange} — Rating Detail
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {selectedTrendBucket.count > 0 ? ((selectedTrendBucket.helpful / selectedTrendBucket.count) * 100).toFixed(1) : 0}% helpful vote rate — {selectedTrendBucket.helpful} of {selectedTrendBucket.count} votes
                                </p>
                            </div>
                            <button
                                title="Close rating detail modal"
                                onClick={handleCloseTrendDetailModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {getTrendBucketVotes(selectedTrendBucket).length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vote</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Comment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {getTrendBucketVotes(selectedTrendBucket).map((vote, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-600">{formatVoteDate(vote.created_at)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{getVoteSourceName(vote)}</td>
                                                    <td className="px-4 py-3 text-sm font-semibold">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${vote.relevant === true ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {getVoteTypeLabel(vote)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{getVoteComment(vote)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <MessageSquare size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No votes recorded for this period</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Relevance Score Details Modal */}
            {showRelevanceScoreModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Star size={24} className="text-yellow-200" />
                                    Relevance Score Details
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {getRelevanceScore()}% helpful vote rate — {helpfulCount} of {totalVotes} votes
                                </p>
                            </div>
                            <button
                                title="Close relevance score details modal"
                                onClick={() => setShowRelevanceScoreModal(false)}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {relevanceDetails.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Helpful</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Not Relevant</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total Votes</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Relevance %</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {relevanceDetails.map((item, index) => (
                                                <tr key={`${item.title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{item.title}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.helpful}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.notRelevant}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">{item.total}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">{item.relevanceRounded}%</td>
                                                    <td className="px-4 py-3 text-right">
                                                        {item.needsReview ? (
                                                            <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                                Needs Review
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                                                                Good
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Star size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No materials with votes found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Top Rated Materials Modal */}
            {showTopRatedModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <ThumbsUp size={24} className="text-blue-200" />
                                    Top Rated Materials
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    Ranked by helpful votes — full list
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleTopRatedExportCSV}
                                    className="bg-white text-[#1E74BC] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    CSV
                                </button>
                                <button
                                    onClick={handleTopRatedExportPDF}
                                    className="bg-white text-[#1E74BC] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                                >
                                    <Download size={16} />
                                    PDF
                                </button>
                                <button
                                    title="Close top rated materials modal"
                                    onClick={() => setShowTopRatedModal(false)}
                                    className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors ml-2"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {topRatedMaterials.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rank</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Helpful Votes</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Not Relevant Votes</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Relevance %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {topRatedMaterials.map((item, index) => (
                                                <tr key={`${item.title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{index + 1}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.title}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.helpful}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.notRelevant}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">{item.relevanceRounded}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <ThumbsUp size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No materials with votes found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Topic Materials Modal */}
            {showTopicMaterialsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BookOpen size={22} className="text-blue-200" />
                                    {selectedTopicName}
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {selectedTopicViewCount} views across theses tagged with this subject
                                </p>
                            </div>
                            <button
                                title="Close topic materials modal"
                                onClick={handleCloseTopicMaterialsModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {topicMaterials && topicMaterials.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Author</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">View Count</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {topicMaterials.map((item, index) => (
                                                <tr key={`${item.title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.title || 'Untitled'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{item.author || '—'}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.view_count || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <BookOpen size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No materials found for this topic</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* NOTE: query-level search linkage for topics not available without backend changes — deferred, see backlog. */}

            {/* All Theses (Most Viewed) Modal */}
            {showAllThesesModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BookOpen size={22} className="text-blue-200" />
                                    Most Viewed Theses
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {allTheses.length} theses with recorded views in the selected period
                                </p>
                            </div>
                            <button
                                title="Close most viewed theses modal"
                                onClick={handleCloseAllThesesModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {allThesesLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-gray-500 text-sm">Loading...</p>
                                </div>
                            ) : allTheses.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Rank</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Author</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Views</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {allTheses.map((item, index) => (
                                                <tr key={`${item.title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{index + 1}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.title || 'Untitled'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{item.author || 'Unknown Author'}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatNumber(item.view_count)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <BookOpen size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No viewed theses found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Gender Detail Modal */}
            {showGenderDetailModal && selectedGenderItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Users size={22} className="text-blue-200" />
                                    {selectedGenderItem.gender} Respondents
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {selectedGenderItem.count} of {dashboardData.genderDistribution.reduce((sum, g) => sum + g.count, 0)} total respondents ({selectedGenderItem.percentage}%)
                                </p>
                            </div>
                            <button
                                title="Close gender detail modal"
                                onClick={handleCloseGenderDetailModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                This reflects self-reported gender from feedback submissions and user account registrations in the selected period. With a small total sample size, percentages can shift significantly with just a few new respondents — consider this alongside <span className="font-semibold">Users by Category</span> for fuller context.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* All Failed Queries Modal */}
            {showAllFailedQueriesModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <AlertCircle size={22} className="text-blue-200" />
                                    Top Failed Queries
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {allFailedQueries.length} unique queries with zero results in the selected period
                                </p>
                            </div>
                            <button
                                title="Close failed queries modal"
                                onClick={handleCloseAllFailedQueriesModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {allFailedQueriesLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-gray-500 text-sm">Loading...</p>
                                </div>
                            ) : allFailedQueries.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Query</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Count</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {allFailedQueries.map((item, index) => (
                                                <tr key={`${item.query}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.query}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{item.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <AlertCircle size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No failed queries found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Activity Trend Detail Modal */}
            {showActivityTrendDetailModal && selectedActivityBucket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar size={22} className="text-blue-200" />
                                    {selectedActivityBucket.tooltipRange || `${selectedActivityBucket.month} ${selectedActivityBucket.year}` || selectedActivityBucket.fullDate}
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {selectedActivityBucket.views} total view{selectedActivityBucket.views !== 1 ? 's' : ''} in this period
                                </p>
                            </div>
                            <button
                                title="Close activity trend detail modal"
                                onClick={handleCloseActivityTrendDetailModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {activityBucketLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-gray-500 text-sm">Loading...</p>
                                </div>
                            ) : activityBucketMaterials.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Author</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Views</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {activityBucketMaterials.map((item, index) => (
                                                <tr key={`${item.title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.title || 'Untitled'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{item.author || 'Unknown Author'}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatNumber(item.view_count)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Calendar size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No materials viewed in this period</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Citation Detail Modal */}
            {showCitationDetailModal && selectedCitationBucket && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Copy size={22} className="text-blue-200" />
                                    {selectedCitationBucket.tooltipRange || `${selectedCitationBucket.month} ${selectedCitationBucket.year}`}
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {selectedCitationBucket.copies} total citation cop{selectedCitationBucket.copies !== 1 ? 'ies' : 'y'} in this period
                                </p>
                            </div>
                            <button
                                title="Close citation detail modal"
                                onClick={handleCloseCitationDetailModal}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {citationBucketLoading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-gray-500 text-sm">Loading...</p>
                                </div>
                            ) : citationBucketMaterials.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Author</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Citations</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {citationBucketMaterials.map((item, index) => (
                                                <tr key={`${item.document__title}-${index}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-700 break-words">{item.document__title || item.document__file || 'Untitled'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{item.document__author || 'Unknown Author'}</td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{item.copies}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Copy size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No citations recorded in this period</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Archive Confirmation Modal (UI-only placeholder) */}
            {showArchiveConfirmModal && archiveTargetMaterial && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Archive material?</h2>
                                <p className="text-blue-100 text-sm mt-1">Archive this material? It will be removed from active search results.</p>
                            </div>
                            <button
                                title="Close"
                                onClick={handleCancelArchive}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <p className="text-gray-700">{archiveTargetMaterial.title}</p>
                        </div>

                        <div className="px-6 py-4 flex items-center justify-end gap-2">
                            <button
                                onClick={handleCancelArchive}
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmArchivePlaceholder}
                                className="bg-[#1E74BC] text-white px-4 py-2 rounded-lg"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Total Votes Details Modal */}
            {showVotesModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#1E74BC] to-[#155a8f] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <MessageSquare size={24} className="text-blue-200" />
                                    Total Votes Details
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    {filteredRatings.length} vote{filteredRatings.length !== 1 ? 's' : ''} in the selected period
                                </p>
                            </div>
                            <button
                                title="Close vote details modal"
                                onClick={() => setShowVotesModal(false)}
                                className="bg-[#1E74BC] hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {filteredRatings.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Material / Thesis</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vote</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Voter</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Comment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredRatings.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((vote, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-600">{formatVoteDate(vote.created_at)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">{getVoteSourceName(vote)}</td>
                                                    <td className="px-4 py-3 text-sm font-semibold">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${vote.relevant === true ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {getVoteTypeLabel(vote)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        {vote.user?.username || vote.username || vote.user?.full_name || '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs break-words">
                                                        {getVoteComment(vote)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <MessageSquare size={48} className="text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-semibold">No votes available for the selected filter</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminDashboard;
