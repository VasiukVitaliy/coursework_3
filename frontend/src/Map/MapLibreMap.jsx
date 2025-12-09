import React from 'react';

const MapLibreMap = React.forwardRef(({ loading }, ref) => {
    return (
        <main className="flex-1 relative bg-gray-200">
            <div ref={ref} className="absolute inset-0 w-full h-full z-0" />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
                    Loading...
                </div>
            )}
        </main>
    );
});

export default MapLibreMap;