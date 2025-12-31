
import React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getAllUsers, updateUserStatus, replaceUsers, exportAllUserData, forceUserLogout, updateUserSubscription, saveUserPersonalAuthToken, addNewUser, removeUser, updateUserBatch02 } from '../../services/userService';
import { assignEmailCodeToUser, getAllFlowAccounts, resetEmailCodeFromUser, type FlowAccount } from '../../services/flowAccountService';
import { type User, type UserStatus, type UserRole, type Language } from '../../types';
import { UsersIcon, XIcon, DownloadIcon, UploadIcon, CheckCircleIcon, AlertTriangleIcon, VideoIcon, TrashIcon, DatabaseIcon, KeyIcon, PencilIcon } from '../Icons';
import Spinner from '../common/Spinner';
import ApiHealthCheckModal from '../common/ApiHealthCheckModal';
import ConfirmationModal from '../common/ConfirmationModal';

const formatStatus = (user: User): { text: string; color: 'green' | 'yellow' | 'red' | 'blue' } => {
    switch(user.status) {
        case 'admin':
            return { text: 'Admin', color: 'blue' };
        case 'lifetime':
            return { text: 'Lifetime', color: 'green' };
        case 'subscription':
            return { text: 'Subscription', color: 'green' };
        case 'trial':
            return { text: 'Trial', color: 'yellow' };
        case 'inactive':
            return { text: 'Inactive', color: 'red' };
        default:
            return { text: 'Unknown', color: 'red' };
    }
};

const statusColors: Record<'green' | 'yellow' | 'red' | 'blue', string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    blue: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300',
};

const TrialCountdown: React.FC<{ expiry: number }> = ({ expiry }) => {
    const calculateRemainingTime = useCallback(() => {
        const now = Date.now();
        const timeLeft = expiry - now;

        if (timeLeft <= 0) {
            return { text: 'Expired', color: 'red' as const };
        }

        const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
        const seconds = Math.floor((timeLeft / 1000) % 60);

        return { text: `Expires in ${minutes}m ${seconds}s`, color: 'yellow' as const };
    }, [expiry]);
    
    const [timeInfo, setTimeInfo] = useState(calculateRemainingTime());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeInfo(calculateRemainingTime());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiry, calculateRemainingTime]);

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[timeInfo.color]}`}>
            {timeInfo.text}
        </span>
    );
};

const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

interface AdminDashboardViewProps {
  language: Language;
}

const StatBox: React.FC<{ title: string; icon: React.ReactNode; data: { label: string; value: number }[]; total: number; color: string; }> = ({ title, icon, data, total, color }) => {
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h4 className="font-bold text-neutral-800 dark:text-neutral-200">{title}</h4>
            </div>
            <div className="space-y-3 text-sm overflow-y-auto custom-scrollbar pr-2 flex-1 max-h-48">
                {sortedData.length > 0 ? sortedData.map(({ label, value }) => {
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    return (
                        <div key={label}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-mono text-neutral-600 dark:text-neutral-400 truncate max-w-[60%]">{label}</span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{value}</span>
                            </div>
                            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full ${color}`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                }) : <p className="text-xs text-neutral-500">No active users.</p>}
            </div>
        </div>
    );
};



const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ language }) => {
    const [users, setUsers] = useState<User[] | null>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newStatus, setNewStatus] = useState<UserStatus>('trial');
    const [subscriptionDuration, setSubscriptionDuration] = useState<6 | 12 | 'lifetime'>(6);
    const [personalToken, setPersonalToken] = useState<string>('');
    const [batch02, setBatch02] = useState<string>(''); // Keep for backward compatibility but not used in UI
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);
    const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
    const [userForHealthCheck, setUserForHealthCheck] = useState<User | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isConfirmLogoutOpen, setIsConfirmLogoutOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState<{email: string; phone: string; status: UserStatus; fullName: string; role: UserRole; batch_02: string}>({ email: '', phone: '', status: 'trial', fullName: '', role: 'user', batch_02: '' });
    const [addUserError, setAddUserError] = useState<string | null>(null);
    const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
    const [isAssigningEmailCode, setIsAssigningEmailCode] = useState<string | null>(null);
    const [flowAccounts, setFlowAccounts] = useState<FlowAccount[]>([]);
    const [selectedFlowAccountCode, setSelectedFlowAccountCode] = useState<string>('');
    const [assignMode, setAssignMode] = useState<'auto' | 'manual'>('auto');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const allUsers = await getAllUsers();
        if (allUsers) {
            setUsers(allUsers); // We need all users for the dashboard
        } else {
            setUsers(null);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Fetch flow accounts when modal opens (for both new assign and reassign)
    useEffect(() => {
        if (isModalOpen && selectedUser) {
            getAllFlowAccounts().then(accounts => {
                const availableAccounts = accounts
                    .filter(acc => acc.status === 'active' && acc.current_users_count < 10)
                    .sort((a, b) => {
                        // Sort by user count (ascending), then by code
                        if (a.current_users_count !== b.current_users_count) {
                            return a.current_users_count - b.current_users_count;
                        }
                        return a.code.localeCompare(b.code);
                    });
                setFlowAccounts(availableAccounts);
                if (availableAccounts.length > 0 && assignMode === 'auto') {
                    // Auto-select the account with lowest user count
                    setSelectedFlowAccountCode(availableAccounts[0].code);
                } else if (availableAccounts.length > 0 && assignMode === 'manual' && !selectedFlowAccountCode) {
                    // If manual mode and no selection, select first available
                    setSelectedFlowAccountCode(availableAccounts[0].code);
                }
            });
        }
    }, [isModalOpen, selectedUser, assignMode]);

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setNewStatus(user.status);
        // Initialize subscriptionDuration based on user status
        if (user.status === 'lifetime') {
            setSubscriptionDuration('lifetime');
        } else {
            setSubscriptionDuration(6); // Default to 6 months
        }
        setPersonalToken(user.personalAuthToken || '');
        setBatch02(user.batch_02 || ''); // Keep for backward compatibility
        setAssignMode('auto');
        setSelectedFlowAccountCode('');
        setIsModalOpen(true);
    };

    const veoAuthorizedUsersCount = useMemo(() => {
        if (!users) return 0;
        // Filter for users who have a non-empty, non-whitespace personal auth token.
        return users.filter(u => u.personalAuthToken && u.personalAuthToken.trim()).length;
    }, [users]);


    const handleSaveChanges = async () => {
        if (!selectedUser) return;
        setStatusMessage({ type: 'loading', message: 'Saving changes...' });

        // Status update logic with VEO check
        const statusPromise = new Promise<{ success: boolean, message?: string }>(async (resolve) => {
            // Determine the actual target status
            let targetStatus = newStatus;
            if (subscriptionDuration === 'lifetime') {
                targetStatus = 'lifetime';
            }
            
            const isUpgradingToVeo = (targetStatus === 'lifetime' || targetStatus === 'subscription') &&
                                    (selectedUser.status !== 'lifetime' && selectedUser.status !== 'subscription');

            // Only block if we are upgrading a user who does NOT already have a token, and the limit is reached.
            if (isUpgradingToVeo && !selectedUser.personalAuthToken && veoAuthorizedUsersCount >= 4) {
                return resolve({ success: false, message: 'Cannot upgrade user status. Veo 3.0 authorization is limited to fewer than 5 users.' });
            }
            
            // Check if status actually needs to be updated
            // Always update if subscriptionDuration is 'lifetime' (even if status is already 'lifetime')
            if (targetStatus === selectedUser.status && subscriptionDuration !== 'lifetime') {
                return resolve({ success: true });
            }
            
            let success = false;
            // If subscriptionDuration is 'lifetime', always set status to 'lifetime'
            if (subscriptionDuration === 'lifetime') {
                success = await updateUserStatus(selectedUser.id, 'lifetime');
            } else if (targetStatus === 'subscription') {
                success = await updateUserSubscription(selectedUser.id, subscriptionDuration);
            } else {
                success = await updateUserStatus(selectedUser.id, targetStatus);
            }
            resolve({ success });
        });

        // Token update logic
        const tokenPromise = new Promise<{ success: boolean; message?: string }>(async (resolve) => {
            const currentToken = selectedUser.personalAuthToken || '';
            const newToken = personalToken.trim();
            if (newToken === currentToken) return resolve({ success: true });

            const result = await saveUserPersonalAuthToken(selectedUser.id, newToken || null);
            if (result.success === false) {
                resolve({ success: false, message: result.message });
            } else {
                resolve({ success: true });
            }
        });
        
        // Batch update removed - using email_code instead
        const batchPromise = Promise.resolve({ success: true });

        const [statusResult, tokenResult, batchResult] = await Promise.all([statusPromise, tokenPromise, batchPromise]);

        const errorMessages = [];
        if (!statusResult.success) {
            errorMessages.push(statusResult.message || 'Failed to update status.');
        }
        if (tokenResult.success === false) {
            errorMessages.push(tokenResult.message || 'Failed to update token.');
        }
        if (!batchResult) {
            errorMessages.push('Failed to update batch.');
        }

        if (errorMessages.length > 0) {
            setStatusMessage({ type: 'error', message: errorMessages.join(' ') });
        } else {
            setStatusMessage({ type: 'success', message: `User ${selectedUser.username} updated successfully.` });
            fetchUsers();
        }

        setIsModalOpen(false);
        setSelectedUser(null);
        setTimeout(() => setStatusMessage(null), 5000);
    };
    
    const handleForceLogout = () => {
        if (!selectedUser) return;
        setIsConfirmLogoutOpen(true);
    };

    const executeForceLogout = async () => {
        if (!selectedUser) return;
        
        if (await forceUserLogout(selectedUser.id)) {
            await fetchUsers();
            setStatusMessage({ type: 'success', message: `Session for ${selectedUser.username} has been terminated.` });
        } else {
             setStatusMessage({ type: 'error', message: 'Failed to terminate session.' });
        }
        setIsModalOpen(false);
        setIsConfirmLogoutOpen(false);
        setSelectedUser(null);
        setTimeout(() => setStatusMessage(null), 4000);
    };


    const handleExport = async () => {
        setStatusMessage(null);
        const usersToExport = await exportAllUserData();
        if (!usersToExport) {
            setStatusMessage({ type: 'error', message: 'Export failed: User database is corrupt.' });
            setTimeout(() => setStatusMessage(null), 4000);
            return;
        }

        try {
            const dataStr = JSON.stringify(usersToExport, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().split('T')[0];
            link.download = `esaie-users-backup-${timestamp}.json`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setStatusMessage({ type: 'success', message: 'User data exported successfully.' });
        } catch (error) {
             setStatusMessage({ type: 'error', message: 'Failed to create export file.' });
        }
        setTimeout(() => setStatusMessage(null), 5000);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        setStatusMessage(null);
        const file = event.target.files?.[0];
        if (!file) return;

        if (window.confirm("Are you sure you want to replace all existing user data with this file's content? This cannot be undone.")) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text !== 'string') throw new Error("Failed to read file.");
                    
                    const importedUsers = JSON.parse(text);
                    const result = await replaceUsers(importedUsers);

                    if (result.success) {
                        setStatusMessage({ type: 'success', message: result.message });
                        fetchUsers(); // Refresh the view
                    } else {
                        setStatusMessage({ type: 'error', message: result.message });
                    }
                } catch (error) {
                    setStatusMessage({ type: 'error', message: `Error importing file: ${error instanceof Error ? error.message : 'Invalid file format.'}` });
                } finally {
                     if(event.target) event.target.value = '';
                     setTimeout(() => setStatusMessage(null), 5000);
                }
            };
            reader.readAsText(file);
        } else {
            if(event.target) event.target.value = '';
        }
    };

    const handleAddNewUser = async () => {
        setAddUserError(null);
        setStatusMessage({ type: 'loading', message: 'Adding new user...' });
        const result = await addNewUser({ ...newUser, batch_02: newUser.batch_02.trim() || null });
    
        if (result.success) {
            setStatusMessage({ type: 'success', message: `User ${newUser.email} added successfully.` });
            fetchUsers();
            setIsAddUserModalOpen(false);
            setNewUser({ email: '', phone: '', status: 'trial', fullName: '', role: 'user', batch_02: '' });
        } else {
            setStatusMessage(null); // Clear loading message
            setAddUserError(result.message || 'An unknown error occurred.');
        }
    };
    
    const handleRemoveUser = () => {
        if (!selectedUser) return;
        setIsConfirmRemoveOpen(true);
    };
    
    const executeRemoveUser = async () => {
        if (!selectedUser) return;
        
        const result = await removeUser(selectedUser.id);
        if (result.success) {
            setStatusMessage({ type: 'success', message: `User ${selectedUser.username} has been removed.` });
            fetchUsers();
        } else {
             setStatusMessage({ type: 'error', message: `Failed to remove user: ${result.message}` });
        }
        setIsModalOpen(false);
        setIsConfirmRemoveOpen(false);
        setSelectedUser(null);
        setTimeout(() => setStatusMessage(null), 4000);
    };

    const usersWithoutAdmin = useMemo(() => users?.filter(user => user.role !== 'admin') || [], [users]);

    const filteredUsers = useMemo(() => {
        if (!users) return [];

        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        
        let displayedUsers: User[];
        const userList = users.filter(user => user.role !== 'admin');

        if (searchTerm.trim() === '') {
            // No search term, show all users
            displayedUsers = userList;
        } else {
            // Search term exists, search all users
            displayedUsers = userList.filter(user =>
                (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort the displayedUsers, keeping active users on top
        return displayedUsers.sort((a, b) => {
            const aLastSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
            const bLastSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;

            const aIsOnline = aLastSeen > 0 && (now - aLastSeen) < oneHour;
            const bIsOnline = bLastSeen > 0 && (now - bLastSeen) < oneHour;

            if (aIsOnline && !bIsOnline) return -1;
            if (!aIsOnline && bIsOnline) return 1;
            
            return bLastSeen - aLastSeen;
        });
    }, [users, searchTerm]);
    
    const activeUsersCount = useMemo(() => {
        if (!users) return 0;
        const now = new Date().getTime();
        const oneHour = 60 * 60 * 1000;
        return users.filter(user => 
            user.role !== 'admin' && user.lastSeenAt && (now - new Date(user.lastSeenAt).getTime()) < oneHour
        ).length;
    }, [users]);

    if (loading) {
        return <div>Loading users...</div>;
    }

    if (users === null) {
        return (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
                <strong className="font-bold">Critical Error:</strong>
                <span className="block sm:inline"> The user database is corrupt and could not be read. Please contact support.</span>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-2">User Database</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Manage users, subscriptions, and database backups.</p>
                
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <input
                        type="text"
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-sm bg-white dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                    />
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-semibold py-2 px-3 rounded-lg">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span>{activeUsersCount} Active Users</span>
                        </div>
                        <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center gap-2 text-sm bg-green-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-700 transition-colors">
                            <UsersIcon className="w-4 h-4" />
                            Add User
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
                        <button onClick={handleImportClick} className="flex items-center gap-2 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-2 px-3 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors">
                            <UploadIcon className="w-4 h-4" />
                            Import
                        </button>
                        <button onClick={handleExport} className="flex items-center gap-2 text-sm bg-primary-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-primary-700 transition-colors">
                            <DownloadIcon className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                 {statusMessage && (
                    <div className={`p-3 rounded-md mb-4 text-sm ${statusMessage.type === 'loading' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' : statusMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                        {statusMessage.message}
                    </div>
                )}

                <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-inner">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400">
                            <thead className="text-xs text-neutral-700 uppercase bg-neutral-100 dark:bg-neutral-800/50 dark:text-neutral-400">
                                <tr>
                                    <th scope="col" className="px-4 py-3">#</th>
                                    <th scope="col" className="px-6 py-3">
                                        Email
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Email CODE
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Last Login
                                    </th>
                                     <th scope="col" className="px-6 py-3">
                                        Version
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Device
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Server
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Token
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user, index) => {
                                        const { text, color } = formatStatus(user);
                                        
                                        let activeInfo: { text: string; color: 'green' | 'gray' | 'red'; fullDate: string; } = { text: 'Never', color: 'red', fullDate: 'N/A' };
                                        if (user.lastSeenAt) {
                                            const lastSeenDate = new Date(user.lastSeenAt);
                                            const diffMinutes = (new Date().getTime() - lastSeenDate.getTime()) / (1000 * 60);
                                            if (diffMinutes < 60) {
                                                activeInfo = { text: 'Active now', color: 'green', fullDate: lastSeenDate.toLocaleString() };
                                            } else {
                                                activeInfo = { text: getTimeAgo(lastSeenDate), color: 'gray', fullDate: lastSeenDate.toLocaleString() };
                                            }
                                        }
                                        const activeStatusColors: Record<'green' | 'gray' | 'red', string> = {
                                            green: 'bg-green-500',
                                            gray: 'bg-neutral-400',
                                            red: 'bg-red-500',
                                        };

                                        return (
                                            <tr key={user.id} className="bg-white dark:bg-neutral-950 border-b dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                                                <td className="px-4 py-4 font-medium text-neutral-600 dark:text-neutral-400">{index + 1}</td>
                                                <th scope="row" className="px-6 py-4 font-medium text-neutral-900 whitespace-nowrap dark:text-white">
                                                    <div>{user.username || '-'}</div>
                                                    <div className="text-xs text-neutral-500">{user.email || '-'}</div>
                                                </th>
                                                <td className="px-6 py-4 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                                                    {user.email_code || '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2" title={`Last seen: ${activeInfo.fullDate}`}>
                                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeStatusColors[activeInfo.color]}`}></span>
                                                        <span>{activeInfo.text}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.appVersion || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                                                    {user.lastDevice || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-300">
                                                    {user.proxyServer ? user.proxyServer.replace('https://', '').replace('.esaie.tech', '') : '-'}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                                                    {user.personalAuthToken ? `...${user.personalAuthToken.slice(-6)}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[color]}`}>
                                                            {text}
                                                        </span>
                                                        {user.status === 'subscription' && user.subscriptionExpiry && (
                                                            <div className="text-xs text-neutral-500 mt-1">
                                                                Expires: {new Date(user.subscriptionExpiry).toLocaleDateString()}
                                                                {Date.now() > user.subscriptionExpiry && <span className="text-red-500 font-bold"> (Expired)</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => openEditModal(user)}
                                                        className="p-2 text-orange-600 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                                        title="Edit user"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center py-10">
                                            {usersWithoutAdmin.length > 0 ? (
                                                <div>
                                                    <p className="mt-2 font-semibold">No users found.</p>
                                                    <p className="text-xs">{searchTerm ? `No users match your search for "${searchTerm}".` : 'No users have been active in the last hour.'}</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <UsersIcon className="w-12 h-12 mx-auto text-neutral-400" />
                                                    <p className="mt-2 font-semibold">No registered users yet.</p>
                                                    <p className="text-xs">When new users register, they will appear here.</p>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Add New User</h3>
                            <button onClick={() => setIsAddUserModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="new-fullname" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Name</label>
                                <input id="new-fullname" type="text" value={newUser.fullName} onChange={(e) => setNewUser({...newUser, fullName: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2" />
                            </div>
                            <div>
                                <label htmlFor="new-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email Address</label>
                                <input id="new-email" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2" />
                            </div>
                            <div>
                                <label htmlFor="new-phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Phone Number</label>
                                <input id="new-phone" type="text" value={newUser.phone} onChange={(e) => setNewUser({...newUser, phone: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="new-status" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Account Status</label>
                                    <select id="new-status" value={newUser.status} onChange={(e) => setNewUser({...newUser, status: e.target.value as UserStatus})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2">
                                        <option value="trial">Trial</option>
                                        <option value="subscription">Subscription</option>
                                        <option value="lifetime">Lifetime</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="new-role" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Role</label>
                                    <select id="new-role" value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2">
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        <option value="special_user">Special User</option>
                                    </select>
                                </div>
                            </div>
                             <div>
                                <label htmlFor="new-batch" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Batch</label>
                                <input id="new-batch" type="text" value={newUser.batch_02} onChange={(e) => setNewUser({...newUser, batch_02: e.target.value})} className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2" />
                            </div>
                            {addUserError && <p className="text-red-500 text-sm">{addUserError}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => { setIsAddUserModalOpen(false); setAddUserError(null); }} className="px-4 py-2 text-sm font-semibold bg-neutral-200 dark:bg-neutral-600 rounded-lg">Cancel</button>
                            <button onClick={handleAddNewUser} className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg">Add User</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" aria-modal="true" role="dialog">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Edit User</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="mb-4 text-sm">Updating profile for <span className="font-semibold">{selectedUser.username}</span>.</p>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="status-select" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Account Status
                                </label>
                                <select
                                    id="status-select"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                                    className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                >
                                    <option value="trial">Trial</option>
                                    <option value="subscription">Subscription</option>
                                    <option value="lifetime">Lifetime</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                             <div>
                                <label htmlFor="token-input" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                    Personal Auth Token
                                </label>
                                <input
                                    id="token-input"
                                    type="text"
                                    value={personalToken}
                                    onChange={(e) => setPersonalToken(e.target.value)}
                                    placeholder="User's personal __SESSION token"
                                    className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono text-xs"
                                />
                            </div>
                             {/* Assign Flow Account */}
                            {!selectedUser.email_code ? (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Flow Account
                                    </label>
                                    
                                    {/* Mode Toggle */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignMode('auto');
                                                if (flowAccounts.length > 0) {
                                                    // Find account with lowest user count
                                                    const sorted = [...flowAccounts].sort((a, b) => 
                                                        a.current_users_count - b.current_users_count
                                                    );
                                                    setSelectedFlowAccountCode(sorted[0].code);
                                                }
                                            }}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'auto'
                                                    ? 'bg-orange-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignMode('manual')}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'manual'
                                                    ? 'bg-orange-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Manual
                                        </button>
                                    </div>

                                    {/* Manual Selection Dropdown */}
                                    {assignMode === 'manual' && (
                                        <div className="mb-3">
                                            <select
                                                value={selectedFlowAccountCode}
                                                onChange={(e) => setSelectedFlowAccountCode(e.target.value)}
                                                className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
                                            >
                                                <option value="">Select Flow Account</option>
                                                {flowAccounts.map(account => (
                                                    <option key={account.id} value={account.code}>
                                                        {account.code} - {account.email} ({account.current_users_count}/10)
                                                    </option>
                                                ))}
                                            </select>
                                            {flowAccounts.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No available flow accounts. Add accounts in Flow Account tab.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Auto Mode Info */}
                                    {assignMode === 'auto' && flowAccounts.length > 0 && (
                                        <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-800 dark:text-orange-200">
                                            Will assign to: <strong>{flowAccounts[0].code}</strong> ({flowAccounts[0].current_users_count}/10 users)
                                        </div>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (!selectedUser) return;
                                            
                                            if (assignMode === 'manual' && !selectedFlowAccountCode) {
                                                setStatusMessage({ type: 'error', message: 'Please select a flow account' });
                                                setTimeout(() => setStatusMessage(null), 3000);
                                                return;
                                            }

                                            setIsAssigningEmailCode(selectedUser.id);
                                            // Always use selectedFlowAccountCode if available, otherwise use first from sorted list
                                            const codeToUse = selectedFlowAccountCode || (flowAccounts.length > 0 ? flowAccounts[0].code : undefined);
                                            const result = await assignEmailCodeToUser(
                                                selectedUser.id,
                                                codeToUse
                                            );
                                            if (result.success) {
                                                setStatusMessage({ type: 'success', message: `Assigned ${result.emailCode} to user` });
                                                fetchUsers();
                                                setIsModalOpen(false);
                                            } else {
                                                setStatusMessage({ type: 'error', message: result.message });
                                            }
                                            setIsAssigningEmailCode(null);
                                            setTimeout(() => setStatusMessage(null), 5000);
                                        }}
                                        disabled={isAssigningEmailCode === selectedUser.id || (assignMode === 'manual' && !selectedFlowAccountCode) || flowAccounts.length === 0}
                                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {isAssigningEmailCode === selectedUser.id ? 'Assigning...' : 'Assign Flow Account'}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                        Current Flow Account Code
                                    </label>
                                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 font-mono font-semibold text-neutral-600 dark:text-neutral-400 mb-3">
                                        {selectedUser.email_code}
                                    </div>
                                    
                                    {/* Mode Toggle for Reassign */}
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignMode('auto');
                                                if (flowAccounts.length > 0) {
                                                    const sorted = [...flowAccounts].sort((a, b) => 
                                                        a.current_users_count - b.current_users_count
                                                    );
                                                    setSelectedFlowAccountCode(sorted[0].code);
                                                }
                                            }}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'auto'
                                                    ? 'bg-orange-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Auto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignMode('manual')}
                                            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-lg transition-all ${
                                                assignMode === 'manual'
                                                    ? 'bg-orange-600 text-white shadow-sm'
                                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                                            }`}
                                        >
                                            Manual
                                        </button>
                                    </div>

                                    {/* Manual Selection Dropdown for Reassign */}
                                    {assignMode === 'manual' && (
                                        <div className="mb-3">
                                            <select
                                                value={selectedFlowAccountCode}
                                                onChange={(e) => setSelectedFlowAccountCode(e.target.value)}
                                                className="w-full bg-neutral-50 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
                                            >
                                                <option value="">Select Flow Account</option>
                                                {flowAccounts.map(account => (
                                                    <option key={account.id} value={account.code}>
                                                        {account.code} - {account.email} ({account.current_users_count}/10)
                                                    </option>
                                                ))}
                                            </select>
                                            {flowAccounts.length === 0 && (
                                                <p className="text-xs text-red-500 mt-1">No available flow accounts. Add accounts in Flow Account tab.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Auto Mode Info for Reassign */}
                                    {assignMode === 'auto' && flowAccounts.length > 0 && (
                                        <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-800 dark:text-orange-200">
                                            Will reassign to: <strong>{flowAccounts[0].code}</strong> ({flowAccounts[0].current_users_count}/10 users)
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={async () => {
                                                if (!selectedUser) return;
                                                
                                                if (!confirm(`Are you sure you want to reset flow account for this user? This will clear the email code.`)) {
                                                    return;
                                                }

                                                setIsAssigningEmailCode(selectedUser.id);
                                                const result = await resetEmailCodeFromUser(selectedUser.id);
                                                if (result.success) {
                                                    setStatusMessage({ type: 'success', message: 'Flow account code reset successfully' });
                                                    fetchUsers();
                                                    setIsModalOpen(false);
                                                } else {
                                                    setStatusMessage({ type: 'error', message: result.message || 'Failed to reset email code' });
                                                }
                                                setIsAssigningEmailCode(null);
                                                setTimeout(() => setStatusMessage(null), 5000);
                                            }}
                                            disabled={isAssigningEmailCode === selectedUser.id}
                                            className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isAssigningEmailCode === selectedUser.id ? 'Resetting...' : 'Reset'}
                                        </button>
                                        
                                        <button
                                            onClick={async () => {
                                                if (!selectedUser) return;
                                                
                                                if (assignMode === 'manual' && !selectedFlowAccountCode) {
                                                    setStatusMessage({ type: 'error', message: 'Please select a flow account' });
                                                    setTimeout(() => setStatusMessage(null), 3000);
                                                    return;
                                                }
                                                
                                                // First reset, then assign new
                                                setIsAssigningEmailCode(selectedUser.id);
                                                
                                                // Reset first
                                                const resetResult = await resetEmailCodeFromUser(selectedUser.id);
                                                if (!resetResult.success) {
                                                    setStatusMessage({ type: 'error', message: resetResult.message || 'Failed to reset email code' });
                                                    setIsAssigningEmailCode(null);
                                                    setTimeout(() => setStatusMessage(null), 5000);
                                                    return;
                                                }

                                                // Then assign new - always use selectedFlowAccountCode if available
                                                const codeToUse = selectedFlowAccountCode || (flowAccounts.length > 0 ? flowAccounts[0].code : undefined);
                                                const assignResult = await assignEmailCodeToUser(
                                                    selectedUser.id,
                                                    codeToUse
                                                );
                                                
                                                if (assignResult.success) {
                                                    setStatusMessage({ type: 'success', message: `Reassigned ${assignResult.emailCode} to user` });
                                                    fetchUsers();
                                                    setIsModalOpen(false);
                                                } else {
                                                    setStatusMessage({ type: 'error', message: assignResult.message });
                                                }
                                                setIsAssigningEmailCode(null);
                                                setTimeout(() => setStatusMessage(null), 5000);
                                            }}
                                            disabled={isAssigningEmailCode === selectedUser.id || (assignMode === 'manual' && !selectedFlowAccountCode) || flowAccounts.length === 0}
                                            className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isAssigningEmailCode === selectedUser.id ? 'Reassigning...' : 'Reassign'}
                                        </button>
                                    </div>
                                    
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                        Reset: Clear current code | Reassign: Assign new flow account
                                    </p>
                                </div>
                            )}
                            {newStatus === 'subscription' && (
                                <div className="mt-4 p-3 bg-neutral-100 dark:bg-neutral-700/50 rounded-md">
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Subscription Duration
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value={6} checked={subscriptionDuration === 6} onChange={() => setSubscriptionDuration(6)} className="form-radio" />
                                            <span className="ml-2">6 Months</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value={12} checked={subscriptionDuration === 12} onChange={() => setSubscriptionDuration(12)} className="form-radio" />
                                            <span className="ml-2">12 Months</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="radio" name="duration" value="lifetime" checked={subscriptionDuration === 'lifetime'} onChange={() => {
                                                setSubscriptionDuration('lifetime');
                                                setNewStatus('lifetime');
                                            }} className="form-radio" />
                                            <span className="ml-2">Lifetime</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Action Buttons Section */}
                        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                            <div className="grid grid-cols-4 gap-2">
                                <button
                                    onClick={handleForceLogout}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <XIcon className="w-4 h-4" />
                                    Logout
                                </button>
                                <button
                                    onClick={handleRemoveUser}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Remove
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full px-4 py-2.5 text-sm font-semibold bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveChanges}
                                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {isConfirmLogoutOpen && selectedUser && (
                <ConfirmationModal
                    isOpen={isConfirmLogoutOpen}
                    title="Confirm Force Logout"
                    message={`Are you sure you want to terminate ${selectedUser.username}'s current session? They will be logged out immediately, but their account will remain active.`}
                    onConfirm={executeForceLogout}
                    onCancel={() => setIsConfirmLogoutOpen(false)}
                    confirmText="Logout"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                    language={language}
                />
            )}

            {isConfirmRemoveOpen && selectedUser && (
                <ConfirmationModal
                    isOpen={isConfirmRemoveOpen}
                    title="Confirm Remove User"
                    message={`Are you sure you want to permanently remove ${selectedUser.username}? This action cannot be undone.`}
                    onConfirm={executeRemoveUser}
                    onCancel={() => setIsConfirmRemoveOpen(false)}
                    confirmText="Remove"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                    language={language}
                />
            )}

            {isHealthModalOpen && (
                <ApiHealthCheckModal
                    isOpen={isHealthModalOpen}
                    onClose={() => {
                        setIsHealthModalOpen(false);
                        setUserForHealthCheck(null);
                    }}
                    user={userForHealthCheck}
                    language={language}
                />
            )}
        </>
    );
};

export default AdminDashboardView;