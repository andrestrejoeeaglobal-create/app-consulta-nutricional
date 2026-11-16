import React from 'react';
import { HexagonIdentityBar } from './ui/HexagonIdentityBar';

export const FooterLoader = () => {
    return (
        <div
            id="loader-iso"
            className="relative m-0 p-0 flex items-center justify-center w-full h-full"
        >
            <HexagonIdentityBar />
        </div>
    );
};

export default FooterLoader;
