'use client';

import { useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TimeSeriesData } from '@/lib/calculations';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface ChartsProps {
    timeSeriesData: TimeSeriesData[];
}

export default function Charts({ timeSeriesData }: ChartsProps) {
    const dates = timeSeriesData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#C8D2DD',
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: '#1a1a1a',
                titleColor: '#FFFFFF',
                bodyColor: '#C8D2DD',
                borderColor: '#F40755',
                borderWidth: 1,
                padding: 12
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#7F858D',
                    maxTicksLimit: 10
                },
                grid: {
                    color: '#2a2a2a'
                }
            },
            y: {
                ticks: {
                    color: '#7F858D'
                },
                grid: {
                    color: '#2a2a2a'
                }
            }
        }
    };

    const chartData = (label: string, data: number[]) => ({
        labels: dates,
        datasets: [{
            label,
            data,
            borderColor: '#F40755',
            backgroundColor: 'rgba(244, 7, 85, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    });

    return (
        <div className="charts-section">
            <h2 className="charts-title">📈 Historical Trends</h2>
            <div className="charts-grid charts-grid-top">
                <div className="chart-container">
                    <h3>Unique Wallets Over Time</h3>
                    <Line
                        data={chartData('Unique Wallets', timeSeriesData.map(d => d.uniqueWallets))}
                        options={chartOptions}
                    />
                </div>
                <div className="chart-container">
                    <h3>Transactions Over Time</h3>
                    <Line
                        data={chartData('Total Transactions', timeSeriesData.map(d => d.transactions))}
                        options={chartOptions}
                    />
                </div>
                <div className="chart-container">
                    <h3>Gas Cost Over Time (CHZ)</h3>
                    <Line
                        data={chartData('Gas Cost (CHZ)', timeSeriesData.map(d => d.gasCost))}
                        options={chartOptions}
                    />
                </div>
                <div className="chart-container">
                    <h3>Volume Over Time (CHZ)</h3>
                    <Line
                        data={chartData('Total Volume (CHZ)', timeSeriesData.map(d => d.volume))}
                        options={chartOptions}
                    />
                </div>
                <div className="chart-container">
                    <h3>Volume Received Over Time (CHZ)</h3>
                    <Line
                        data={chartData('Volume Received (CHZ)', timeSeriesData.map(d => d.volumeReceived))}
                        options={chartOptions}
                    />
                </div>
                <div className="chart-container">
                    <h3>Volume Redistributed Over Time (CHZ)</h3>
                    <Line
                        data={chartData('Volume Redistributed (CHZ)', timeSeriesData.map(d => d.volumeRedistributed))}
                        options={chartOptions}
                    />
                </div>
            </div>
            <div className="charts-grid charts-grid-bottom">
                <div className="chart-container">
                    <h3>Fees Generated Over Time (CHZ)</h3>
                    <Line
                        data={chartData('Fees Generated (CHZ)', timeSeriesData.map(d => d.fees))}
                        options={chartOptions}
                    />
                </div>
            </div>
        </div>
    );
}

