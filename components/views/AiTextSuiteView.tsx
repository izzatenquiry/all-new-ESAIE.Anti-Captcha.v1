
import React, { useState, useEffect } from 'react';
import ContentIdeasView from './ContentIdeasView';
import MarketingCopyView from './MarketingCopyView';
import StaffMonoklixView from './StaffMonoklixView';
import Tabs, { type Tab } from '../common/Tabs';
import { type User, type Language } from '../../types';

type TabId = 'staff-esaie' | 'content-ideas' | 'marketing-copy';

interface AiTextSuiteViewProps {
    currentUser: User;
    language: Language;
}

const AiTextSuiteView: React.FC<AiTextSuiteViewProps> = ({ currentUser, language }) => {
    const [activeTab, setActiveTab] = useState<TabId>('staff-esaie');

    const tabs: Tab<TabId>[] = [
        { id: 'staff-esaie', label: "Staff ESAIE" },
        { id: 'content-ideas', label: "Content Ideas" },
        { id: 'marketing-copy', label: "Marketing Copy" },
    ];

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'staff-esaie':
                return <StaffMonoklixView language={language} />;
            case 'content-ideas':
                return <ContentIdeasView language={language} />;
            case 'marketing-copy':
                return <MarketingCopyView language={language} />;
            default:
                return <StaffMonoklixView language={language} />;
        }
    };

    return (
        <div className="h-auto lg:h-full flex flex-col">
            <div className="flex-shrink-0 mb-2 sm:mb-4 lg:mb-6 flex justify-center">
                <Tabs 
                    tabs={tabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isAdmin={currentUser.role === 'admin' || currentUser.status === 'lifetime'}
                />
            </div>
            <div className="flex-1 min-h-0">
                {renderActiveTabContent()}
            </div>
        </div>
    );
};

export default AiTextSuiteView;
