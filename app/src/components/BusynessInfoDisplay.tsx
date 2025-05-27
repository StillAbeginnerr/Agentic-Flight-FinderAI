import React from 'react';

interface BusynessInfoDisplayProps {
    info: any;
}

const BusynessInfoDisplay: React.FC<BusynessInfoDisplayProps> = ({ info }) => {
    if (!info) return null;
    return (
        <div className="bg-blue-900 p-4 rounded-md mb-4 text-white">
            <h3 className="font-medium mb-2">Busiest Traveling Period Info</h3>
            {/* Display key info from the busyness info object */}
            <p>
                <strong>Period:</strong> {info.period || "N/A"}
            </p>
            <p>
                <strong>Rating:</strong> {info.rating || "N/A"}
            </p>
            {info.details && (
                <p>
                    <strong>Details:</strong> {info.details}
                </p>
            )}
        </div>
    );
};

export default BusynessInfoDisplay; 