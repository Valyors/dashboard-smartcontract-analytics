'use client';

import { useState, useEffect } from 'react';
import { getAllTransactions, getInternalTransactions } from '@/lib/api';
import { calculateStats, calculateTimeSeriesData, Stats, TimeSeriesData } from '@/lib/calculations';
import { formatNumber, formatCHZ } from '@/lib/utils';
import Charts from './Charts';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[] | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Fetching transactions...');
            const [transactions, internalTransactions] = await Promise.all([
                getAllTransactions(),
                getInternalTransactions()
            ]);

            console.log(`Normal transactions: ${transactions.length}`);
            console.log(`Internal transactions: ${internalTransactions.length}`);

            const calculatedStats = calculateStats(transactions, internalTransactions);
            console.log('Statistics calculated:', calculatedStats);

            const calculatedTimeSeries = calculateTimeSeriesData(transactions, internalTransactions);
            console.log('Time series data calculated:', calculatedTimeSeries.length, 'days');

            setStats(calculatedStats);
            setTimeSeriesData(calculatedTimeSeries);
            
            const now = new Date();
            setLastUpdate(`Last update: ${now.toLocaleString('en-US')}`);
        } catch (err) {
            console.error('Error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p>Loading data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-message">
                <p>❌ Error: {error}</p>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <>
            <div id="statsGrid">
                <div className="stats-grid stats-grid-top">
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <h3>Unique Wallets</h3>
                            <p className="stat-value">{formatNumber(stats.uniqueWallets)}</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-content">
                            <h3>Total Transactions</h3>
                            <p className="stat-value">{formatNumber(stats.totalTransactions)}</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">⛽</div>
                        <div className="stat-content">
                            <h3>Total Gas Cost (CHZ)</h3>
                            <p className="stat-value">{formatCHZ(stats.totalGasUsedCHZ)}</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                            <h3>Total Volume (CHZ)</h3>
                            <p className="stat-value">{formatCHZ(stats.totalCHZTransferred)}</p>
                        </div>
                    </div>
                </div>

                <div className="stats-grid stats-grid-bottom">
                    <div className="stat-card">
                        <div className="stat-icon">💸</div>
                        <div className="stat-content">
                            <h3>Volume Received (Bets)</h3>
                            <p className="stat-value">{formatCHZ(stats.betsReceived)}</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">🎁</div>
                        <div className="stat-content">
                            <h3>Volume Redistributed</h3>
                            <p className="stat-value">{formatCHZ(stats.winningsRedistributed)}</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">💵</div>
                        <div className="stat-content">
                            <h3>Fees Generated (CHZ)</h3>
                            <p className="stat-value">{formatCHZ(stats.feesGenerated)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {timeSeriesData && <Charts timeSeriesData={timeSeriesData} />}

            <div className="refresh-section">
                <button className="refresh-btn" onClick={loadData}>
                    🔄 Refresh
                </button>
                <p className="last-update">{lastUpdate}</p>
            </div>
        </>
    );
}

