import { CONTRACT_ADDRESS, CONTRACT_CREATION_DATE, weiToCHZ } from './utils';
import { Transaction, InternalTransaction } from './api';

export interface Stats {
    uniqueWallets: number;
    totalTransactions: number;
    totalGasUsedCHZ: number;
    totalCHZTransferred: number;
    betsReceived: number;
    winningsRedistributed: number;
    feesGenerated: number;
}

export interface TimeSeriesData {
    date: string;
    uniqueWallets: number;
    transactions: number;
    gasCost: number;
    volume: number;
    volumeReceived: number;
    volumeRedistributed: number;
    fees: number;
}

// Calculate statistics
export function calculateStats(
    transactions: Transaction[],
    internalTransactions: InternalTransaction[]
): Stats {
    const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();
    const stats = {
        uniqueWallets: new Set<string>(),
        totalTransactions: transactions.length,
        internalTxCount: internalTransactions.length,
        totalGasUsed: 0,
        totalGasCost: 0,
        totalCHZTransferred: 0,
        incomingTx: 0,
        outgoingTx: 0,
        totalValue: 0,
        winningsPaid: 0,
        betsReceived: 0
    };

    // Analyze normal transactions
    transactions.forEach(tx => {
        if (tx.from) stats.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) stats.uniqueWallets.add(tx.to.toLowerCase());
        
        if (tx.gasUsed) {
            const gasUsed = parseInt(tx.gasUsed);
            stats.totalGasUsed += gasUsed;
            
            if (tx.gasPrice) {
                const gasPrice = parseInt(tx.gasPrice);
                const gasCost = gasUsed * gasPrice;
                stats.totalGasCost += gasCost;
            }
        }
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            stats.totalValue += valueCHZ;
            
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                stats.incomingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.betsReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                stats.outgoingTx++;
                stats.totalCHZTransferred += valueCHZ;
            }
        }
    });

    // Analyze internal transactions
    const txGroups = new Map<string, Array<{ to: string; value: number }>>();
    
    internalTransactions.forEach(tx => {
        if (tx.from) stats.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) stats.uniqueWallets.add(tx.to.toLowerCase());
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            stats.totalValue += valueCHZ;
            
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                stats.incomingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.betsReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                stats.outgoingTx++;
                stats.totalCHZTransferred += valueCHZ;
                stats.winningsPaid += valueCHZ;
                
                const parentHash = tx.hash || '';
                if (parentHash) {
                    if (!txGroups.has(parentHash)) {
                        txGroups.set(parentHash, []);
                    }
                    txGroups.get(parentHash)!.push({ to: toAddress, value: valueCHZ });
                }
            }
        }
    });
    
    // Calculate fees
    let feesTotal = 0;
    const FEE_PERCENTAGE = 0.05;
    
    txGroups.forEach((transactions) => {
        const groupTotal = transactions.reduce((sum, tx) => sum + tx.value, 0);
        const expectedFee = groupTotal * FEE_PERCENTAGE;
        
        let bestMatch: { value: number } | null = null;
        let bestDiff = Infinity;
        
        transactions.forEach(tx => {
            const diff = Math.abs(tx.value - expectedFee);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = tx;
            }
        });
        
        if (bestMatch && bestDiff < expectedFee * 0.2) {
            feesTotal += bestMatch.value;
        }
    });
    
    if (feesTotal === 0 || feesTotal < stats.betsReceived * FEE_PERCENTAGE * 0.5) {
        feesTotal = stats.betsReceived * FEE_PERCENTAGE;
    }
    
    const winningsRedistributed = stats.winningsPaid - feesTotal;
    const totalAllTransactions = stats.totalTransactions + stats.internalTxCount;

    return {
        uniqueWallets: stats.uniqueWallets.size,
        totalTransactions: totalAllTransactions,
        totalGasUsedCHZ: weiToCHZ(stats.totalGasCost),
        totalCHZTransferred: stats.totalCHZTransferred,
        betsReceived: stats.betsReceived,
        winningsRedistributed: Math.max(0, winningsRedistributed),
        feesGenerated: feesTotal
    };
}

// Calculate time-based data for charts
export function calculateTimeSeriesData(
    transactions: Transaction[],
    internalTransactions: InternalTransaction[]
): TimeSeriesData[] {
    const contractAddressLower = CONTRACT_ADDRESS.toLowerCase();
    const dailyData = new Map<string, {
        date: string;
        uniqueWallets: Set<string>;
        transactions: number;
        gasCost: number;
        volume: number;
        volumeReceived: number;
        volumeRedistributed: number;
        fees: number;
    }>();
    
    function getDateKey(timestamp: string): string {
        const date = new Date(parseInt(timestamp) * 1000);
        return date.toISOString().split('T')[0];
    }
    
    // Initialize all days from contract creation to today
    const today = new Date();
    const currentDate = new Date(CONTRACT_CREATION_DATE);
    while (currentDate <= today) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyData.set(dateKey, {
            date: dateKey,
            uniqueWallets: new Set(),
            transactions: 0,
            gasCost: 0,
            volume: 0,
            volumeReceived: 0,
            volumeRedistributed: 0,
            fees: 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Process normal transactions
    transactions.forEach(tx => {
        if (!tx.timeStamp) return;
        const dateKey = getDateKey(tx.timeStamp);
        const dayData = dailyData.get(dateKey);
        if (!dayData) return;
        
        if (tx.from) dayData.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) dayData.uniqueWallets.add(tx.to.toLowerCase());
        
        dayData.transactions++;
        
        if (tx.gasUsed && tx.gasPrice) {
            const gasCost = parseInt(tx.gasUsed) * parseInt(tx.gasPrice);
            dayData.gasCost += gasCost;
        }
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            dayData.volume += valueCHZ;
            
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            if (toAddress === contractAddressLower) {
                dayData.volumeReceived += valueCHZ;
            }
        }
    });
    
    // Process internal transactions
    const txGroups = new Map<string, Array<{ value: number; dateKey: string }>>();
    const FEE_PERCENTAGE = 0.05;
    
    internalTransactions.forEach(tx => {
        if (!tx.timeStamp) return;
        const dateKey = getDateKey(tx.timeStamp);
        const dayData = dailyData.get(dateKey);
        if (!dayData) return;
        
        if (tx.from) dayData.uniqueWallets.add(tx.from.toLowerCase());
        if (tx.to) dayData.uniqueWallets.add(tx.to.toLowerCase());
        
        if (tx.value && tx.value !== '0') {
            const valueCHZ = weiToCHZ(tx.value);
            const toAddress = tx.to ? tx.to.toLowerCase() : '';
            const fromAddress = tx.from ? tx.from.toLowerCase() : '';
            
            if (toAddress === contractAddressLower) {
                dayData.volumeReceived += valueCHZ;
            } else if (fromAddress === contractAddressLower) {
                dayData.volume += valueCHZ;
                
                const parentHash = tx.hash || '';
                if (parentHash) {
                    if (!txGroups.has(parentHash)) {
                        txGroups.set(parentHash, []);
                    }
                    txGroups.get(parentHash)!.push({ value: valueCHZ, dateKey });
                }
            }
        }
    });
    
    // Calculate fees per day
    txGroups.forEach((transactions) => {
        const groupTotal = transactions.reduce((sum, tx) => sum + tx.value, 0);
        const expectedFee = groupTotal * FEE_PERCENTAGE;
        
        let bestMatch: { value: number; dateKey: string } | null = null;
        let bestDiff = Infinity;
        
        transactions.forEach(tx => {
            const diff = Math.abs(tx.value - expectedFee);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = tx;
            }
        });
        
        if (bestMatch && bestDiff < expectedFee * 0.2) {
            const dayData = dailyData.get(bestMatch.dateKey);
            if (dayData) {
                dayData.fees += bestMatch.value;
                dayData.volumeRedistributed += (groupTotal - bestMatch.value);
            }
        }
    });
    
    // Convert to arrays and calculate cumulative values
    const sortedDates = Array.from(dailyData.keys()).sort();
    let cumulativeWallets = new Set<string>();
    let cumulativeTransactions = 0;
    let cumulativeGasCost = 0;
    let cumulativeVolume = 0;
    let cumulativeVolumeReceived = 0;
    let cumulativeVolumeRedistributed = 0;
    let cumulativeFees = 0;
    
    return sortedDates.map(dateKey => {
        const dayData = dailyData.get(dateKey)!;
        cumulativeWallets = new Set([...cumulativeWallets, ...dayData.uniqueWallets]);
        cumulativeTransactions += dayData.transactions;
        cumulativeGasCost += dayData.gasCost;
        cumulativeVolume += dayData.volume;
        cumulativeVolumeReceived += dayData.volumeReceived;
        cumulativeVolumeRedistributed += dayData.volumeRedistributed;
        cumulativeFees += dayData.fees;
        
        return {
            date: dateKey,
            uniqueWallets: cumulativeWallets.size,
            transactions: cumulativeTransactions,
            gasCost: weiToCHZ(cumulativeGasCost),
            volume: cumulativeVolume,
            volumeReceived: cumulativeVolumeReceived,
            volumeRedistributed: cumulativeVolumeRedistributed,
            fees: cumulativeFees
        };
    });
}

