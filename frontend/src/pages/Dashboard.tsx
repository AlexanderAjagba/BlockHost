import React from 'react';
import './homepage.css';

const Homepage: React.FC = () => {
    return (
        <div className="homepage">
            <nav className="topbar">
                <div className="topbar-container">
                    <div className="topbar-logo">BlockHost</div>
                    <ul className="topbar-menu">
                        <li><a href="#home">Home</a></li>
                        <li><a href="#manage-worlds">Manage Worlds</a></li>
                    </ul>
                </div>
            </nav>
            
            <main className="content">
                {/* Main content goes here */}
            </main>
        </div>
    );
};

export default Homepage;