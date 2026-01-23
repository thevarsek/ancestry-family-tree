import { useState, useEffect } from 'react';
import { Authenticated, Unauthenticated } from 'convex/react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { SignIn } from './components/auth/SignIn';
import { TreeList } from './components/trees/TreeList';
import { TreePage } from './pages/TreePage';
import { TreeSettings } from './pages/TreeSettings';
import { PersonPage } from './pages/PersonPage';
import { LifeEventPage } from './pages/LifeEventPage';
import { SourcePage } from './pages/SourcePage';
import { CommandPalette } from './components/ui/CommandPalette';
import { ToastProvider } from './components/ui/Toast';
import { UserButton } from "@clerk/clerk-react";
import './App.css';

function AppLayout() {
    const navigate = useNavigate();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Global keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(open => !open);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="app">
            <header className="app-header">
                <div className="container">
                    <div className="header-content">
                        <div className="logo cursor-pointer" onClick={() => navigate('/')}>
                            <img src="/logo.png" alt="Ancestry Tracker" className="logo-img" />
                            <h1 className="logo-text">Ancestry Tracker</h1>
                        </div>
                        <nav className="header-nav">
                            <button className="btn btn-ghost" onClick={() => navigate('/')}>Trees</button>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setIsSearchOpen(true)}
                            >
                                Search
                            </button>
                            <div className="ml-4">
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="app-main">
                <Routes>
                    <Route path="/" element={<TreeList />} />
                    <Route path="/tree/:treeId" element={<TreePage />} />
                    <Route path="/tree/:treeId/settings" element={<TreeSettings />} />
                    <Route path="/tree/:treeId/person/:personId" element={<PersonPage />} />
                    <Route path="/tree/:treeId/person/:personId/event/:claimId" element={<LifeEventPage />} />
                    <Route path="/tree/:treeId/person/:personId/source/:sourceId" element={<SourcePage />} />
                    <Route path="/tree/:treeId/source/:sourceId" element={<SourcePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            <footer className="app-footer">
                <div className="container">
                    <p className="footer-text">
                        Ancestry Tracker — Evidence-based family history
                    </p>
                </div>
            </footer>

            <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <Unauthenticated>
                    <SignIn />
                </Unauthenticated>

                <Authenticated>
                    <AppLayout />
                </Authenticated>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;
