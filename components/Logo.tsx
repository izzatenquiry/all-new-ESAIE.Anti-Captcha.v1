import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src="https://monoklix.com/wp-content/uploads/2025/11/ESAIE-Logo-latest.png" 
    className={className} 
    alt="ESAIE Logo"
  />
);
