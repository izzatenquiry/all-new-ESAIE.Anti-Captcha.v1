
import React, { useState } from 'react';
import LibraryView from './LibraryView';
import Tabs, { type Tab } from '../common/Tabs';
import { type Language } from '../../types';

interface AiPromptLibrarySuiteViewProps {
    onUsePrompt: (prompt: string) => void;
    language: Language;
}

type TabId = 'library';

const AiPromptLibrarySuiteView: React.FC<AiPromptLibrarySuiteViewProps> = ({ onUsePrompt, language }) => {
    const [activeTab, setActiveTab] = useState<TabId>('library');

    const tabs: Tab<TabId>[] = [
        { id: 'library', label: "Prompt Library" },
    ];

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'library':
                return <LibraryView onUsePrompt={onUsePrompt} language={language} />;
            default:
                return <LibraryView onUsePrompt={onUsePrompt} language={language} />;
        }
    };

    return (
        <div className="h-auto lg:h-full flex flex-col">
            <div className="flex-shrink-0 mb-6 flex justify-center">
                <Tabs 
                    tabs={tabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
                {renderActiveTabContent()}
            </div>
        </div>
    );
};

export default AiPromptLibrarySuiteView;
